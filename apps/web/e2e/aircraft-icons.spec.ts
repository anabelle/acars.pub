import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { aircraftModels } from "../../../packages/data/src/aircraft";
import { FAMILY_ICONS, LIGHT_DOT_SVG } from "../../../packages/map/src/icons";
import { addFlightLayers } from "../../../packages/map/src/layers/flights";
import {
  alphaToSdf,
  ICON_PIXEL_RATIO,
  resizeSvg,
  sdfIconDimensions,
  svgLogicalSize,
} from "../../../packages/map/src/sdf";
import { DARK_MAP_PALETTE } from "../../../packages/map/src/theme";
import { buildContrailImage } from "../../../packages/map/src/trail";

/**
 * Aircraft icon harness (S42): every family drawn by MapLibre with the real
 * flight layer specs and SDF icons, at three zooms, on a plain background.
 * Asserts each livery tint shows up; with S42_SCREENSHOT set, saves a PNG
 * per zoom. Served from the preview server (same origin as the shipped
 * maplibre worker) via request routing, so it needs no app state.
 */

const require = createRequire(import.meta.url);
const MAPLIBRE_DIST = path.dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
const BACKGROUND = "#0b1220";

const HTML = `<!doctype html><html><head><meta charset="utf-8" />
<style>html,body,#map{margin:0;width:100%;height:100%;background:${BACKGROUND}}</style></head>
<body><div id="map"></div><script type="module">
import * as maplibregl from "/__icons/maplibre-gl.mjs";
maplibregl.config.WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
window.maplibregl = maplibregl;
window.harnessReady = true;
</script></body></html>`;

/** Livery pairs, distinct enough to count pixels per family. */
const LIVERIES = [
  ["#ef4444", "#fde047"],
  ["#22c55e", "#f8fafc"],
  ["#3b82f6", "#f97316"],
  ["#a855f7", "#facc15"],
  ["#f97316", "#1e3a8a"],
  ["#14b8a6", "#f43f5e"],
  ["#eab308", "#1f2937"],
  ["#ec4899", "#e2e8f0"],
  ["#84cc16", "#7c2d12"],
  ["#06b6d4", "#fde68a"],
  ["#f43f5e", "#0f172a"],
  ["#8b5cf6", "#fbbf24"],
] as const;

/** The layer specs exactly as the globe adds them (recorded off a stand-in map). */
function recordFlightLayers() {
  const layers: Array<{ spec: unknown; before?: string }> = [];
  addFlightLayers(
    { addLayer: (spec: unknown, before?: string) => layers.push({ spec, before }) } as never,
    DARK_MAP_PALETTE,
  );
  return layers;
}

/** Rasterises each SVG in the page, then builds its distance field here. */
async function buildSdfIcons(page: Page) {
  const svgs: Record<string, string> = { "light-dot": LIGHT_DOT_SVG };
  for (const [family, { body, accent }] of Object.entries(FAMILY_ICONS)) {
    svgs[`airplane-${family}`] = body;
    svgs[`airplane-${family}-accent`] = accent;
  }
  const jobs = Object.entries(svgs).map(([id, svg]) => {
    const { inner, buffer, size } = sdfIconDimensions(svgLogicalSize(svg));
    return { id, src: resizeSvg(svg, inner), inner, buffer, size };
  });
  const alphas = await page.evaluate(async (list) => {
    const out: Record<string, number[]> = {};
    for (const job of list) {
      const img = new Image();
      img.src = `data:image/svg+xml;base64,${btoa(job.src)}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = job.size;
      canvas.height = job.size;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(img, job.buffer, job.buffer, job.inner, job.inner);
      const { data } = ctx.getImageData(0, 0, job.size, job.size);
      out[job.id] = Array.from({ length: job.size * job.size }, (_, i) => data[i * 4 + 3]);
    }
    return out;
  }, jobs);
  return jobs.map((job) => ({
    id: job.id,
    size: job.size,
    sdf: Array.from(alphaToSdf(alphas[job.id], job.size, job.size)),
  }));
}

/** One aircraft per family on a 4 × 3 screen grid around (0, 0) at `zoom`. */
function gridFeatures(zoom: number, spacingPx: number): Feature[] {
  const degPerPx = 360 / (512 * 2 ** zoom);
  const families = Object.keys(FAMILY_ICONS);
  return families.map((familyId, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const wingspan = aircraftModels.find((m) => m.familyId === familyId)?.wingspanM ?? 35.8;
    return {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [(col - 1.5) * spacingPx * degPerPx, (1 - row) * spacingPx * degPerPx],
      },
      properties: {
        id: familyId,
        familyId,
        bearing: 30,
        sizeScale: (wingspan / 35.8) * 1.1,
        strobeOn: 0,
        primaryColor: LIVERIES[i][0],
        secondaryColor: LIVERIES[i][1],
      },
    };
  });
}

/** Pixels in the canvas within `tolerance` of each colour. */
async function countColors(page: Page, colors: string[], tolerance: number) {
  const png = await page.locator("#map canvas").screenshot();
  return page.evaluate(
    async ({ base64, colors, tolerance }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return colors.map(() => 0);
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, image.width, image.height);
      const targets = colors.map((hex) => {
        const v = Number.parseInt(hex.slice(1), 16);
        return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
      });
      const counts = colors.map(() => 0);
      for (let i = 0; i < data.length; i += 4) {
        targets.forEach(([r, g, b], k) => {
          if (
            Math.abs(data[i] - r) <= tolerance &&
            Math.abs(data[i + 1] - g) <= tolerance &&
            Math.abs(data[i + 2] - b) <= tolerance
          )
            counts[k]++;
        });
      }
      return counts;
    },
    { base64: png.toString("base64"), colors, tolerance },
  );
}

/** Opens the harness page with the SDF icons and the real flight layers. */
async function openHarness(page: Page) {
  await page.setViewportSize({ width: 900, height: 640 });
  await page.goto("/__icons/index.html");
  await page.waitForFunction(() => (window as unknown as { harnessReady?: boolean }).harnessReady);

  const icons = await buildSdfIcons(page);
  const layers = recordFlightLayers();
  await page.evaluate(
    ({ icons, contrail, layers, background, pixelRatio }) =>
      new Promise<void>((resolve) => {
        const { maplibregl } = window as unknown as {
          maplibregl: typeof import("maplibre-gl");
        };
        const map = new maplibregl.Map({
          container: "map",
          style: {
            version: 8,
            sources: {},
            layers: [{ id: "bg", type: "background", paint: { "background-color": background } }],
          },
          center: [0, 0],
          zoom: 3,
          attributionControl: false,
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
        (window as unknown as { harnessMap: unknown }).harnessMap = map;
        map.on("load", () => {
          for (const icon of icons) {
            const data = new Uint8ClampedArray(icon.size * icon.size * 4);
            icon.sdf.forEach((a, i) => {
              data.set([255, 255, 255, a], i * 4);
            });
            map.addImage(
              icon.id,
              { width: icon.size, height: icon.size, data },
              { sdf: true, pixelRatio },
            );
          }
          const empty = { type: "FeatureCollection" as const, features: [] };
          map.addSource("flights", { type: "geojson", data: empty });
          map.addSource("global-flights", { type: "geojson", data: empty });
          map.addImage(
            "contrail",
            {
              width: contrail.width,
              height: contrail.height,
              data: new Uint8ClampedArray(contrail.data),
            },
            { pixelRatio },
          );
          for (const { spec, before } of layers) {
            map.addLayer(spec as Parameters<typeof map.addLayer>[0], before);
          }
          resolve();
        });
      }),
    {
      icons,
      contrail: (() => {
        const image = buildContrailImage(ICON_PIXEL_RATIO);
        return { width: image.width, height: image.height, data: Array.from(image.data) };
      })(),
      layers,
      background: BACKGROUND,
      pixelRatio: ICON_PIXEL_RATIO,
    },
  );
}

interface Feature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: number[] };
  properties: {
    id: string;
    familyId: string;
    bearing: number;
    sizeScale: number;
    strobeOn: number;
    primaryColor: string;
    secondaryColor: string;
  };
}

/** Shows `player` and `rivals` aircraft at `zoom` and waits for the frame. */
async function showFlights(page: Page, zoom: number, player: Feature[], rivals: Feature[] = []) {
  await page.evaluate(
    ({ zoom, player, rivals }) =>
      new Promise<void>((resolve) => {
        const map = (window as unknown as { harnessMap: import("maplibre-gl").Map }).harnessMap;
        const set = (id: string, features: unknown[]) =>
          (map.getSource(id) as import("maplibre-gl").GeoJSONSource).setData({
            type: "FeatureCollection",
            features: features as never,
          });
        set("flights", player);
        set("global-flights", rivals);
        map.jumpTo({ center: [0, 0], zoom });
        map.once("idle", () => resolve());
        map.triggerRepaint();
      }),
    { zoom, player, rivals },
  );
}

async function screenshot(page: Page, name: string) {
  if (!process.env.S42_SCREENSHOT) return;
  await page.locator("#map canvas").screenshot({
    path: path.resolve(process.env.S42_SCREENSHOT, name),
  });
}

test.describe("aircraft icons", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/__icons/**", async (route) => {
      const name = new URL(route.request().url()).pathname.replace("/__icons/", "");
      if (name === "index.html") {
        await route.fulfill({ contentType: "text/html", body: HTML });
        return;
      }
      if (!/^maplibre-gl(-shared)?\.mjs$/.test(name)) {
        await route.fulfill({ status: 404, body: "" });
        return;
      }
      await route.fulfill({
        contentType: "text/javascript",
        body: readFileSync(path.join(MAPLIBRE_DIST, name)),
      });
    });
  });

  test.setTimeout(120_000);
  test("every family renders, livery-tinted, at three zooms", async ({ page }) => {
    test.setTimeout(120_000);
    await openHarness(page);

    for (const [zoom, spacing] of [
      [3, 120],
      [6, 180],
      [10, 200],
    ] as const) {
      await showFlights(page, zoom, gridFeatures(zoom, spacing));
      await screenshot(page, `icons-z${zoom}.png`);

      // At zoom 3 icons are mostly anti-aliased edge, so match more loosely.
      const counts = await countColors(
        page,
        LIVERIES.map(([primary]) => primary),
        zoom === 3 ? 40 : 12,
      );
      // Larger zooms draw larger aircraft; every family must show its tint.
      const minimum = zoom === 3 ? 4 : 20;
      counts.forEach((count, i) => {
        expect(count, `${Object.keys(FAMILY_ICONS)[i]} tinted at zoom ${zoom}`).toBeGreaterThan(
          minimum,
        );
      });
    }
  });

  test("your aircraft carry an outline that rivals' don't", async ({ page }) => {
    test.setTimeout(120_000);
    await openHarness(page);
    const zoom = 6;
    // Same livery for everyone, so only the outline can tell them apart.
    const same = (features: Feature[], baseSize: number) =>
      features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          primaryColor: "#ef4444",
          secondaryColor: "#fde047",
          sizeScale: (f.properties.sizeScale / 1.1) * baseSize,
        },
      }));
    const grid = gridFeatures(zoom, 180);
    const player = same(
      grid.filter((_, i) => i % 2 === 0),
      1.1,
    );
    const rivals = same(
      grid.filter((_, i) => i % 2 === 1),
      0.8,
    );

    await showFlights(page, zoom, player, rivals);
    await screenshot(page, "player-vs-rivals.png");

    await showFlights(page, zoom, player);
    const [withPlayer] = await countColors(page, [DARK_MAP_PALETTE.flights.playerHalo], 60);
    await showFlights(page, zoom, [], rivals);
    const [withRivals] = await countColors(page, [DARK_MAP_PALETTE.flights.playerHalo], 60);
    expect(withPlayer).toBeGreaterThan(150);
    expect(withRivals).toBeLessThan(withPlayer / 10);
  });

  test("moving aircraft trail a contrail from the tail", async ({ page }) => {
    test.setTimeout(120_000);
    await openHarness(page);
    const zoom = 6;
    const grid = gridFeatures(zoom, 180);
    await showFlights(page, zoom, grid.slice(0, 6), grid.slice(6));
    await screenshot(page, "trails-z6.png");
    // Contrails are white at partial opacity: count faint grey pixels, which
    // the aircraft themselves (saturated liveries) don't produce.
    const [faint] = await countColors(page, ["#3c4250"], 22);
    await showFlights(page, 3, grid.slice(0, 6), grid.slice(6));
    const [faintLowZoom] = await countColors(page, ["#3c4250"], 22);
    expect(faint).toBeGreaterThan(200);
    // Below TRAIL_MIN_ZOOM there are no trails (what's left is icon edges).
    expect(faintLowZoom).toBeLessThan(faint / 4);
  });

  // Opt-in (S42_PERF=1): main-thread cost of 10k rival aircraft updated at
  // 5 Hz, with and without the trail layers, for the S41 comparison.
  test("perf: 10k aircraft with and without trails", async ({ page }) => {
    test.skip(!process.env.S42_PERF, "set S42_PERF=1 to measure");
    test.setTimeout(300_000);
    await openHarness(page);
    const families = Object.keys(FAMILY_ICONS);
    const many: Feature[] = Array.from({ length: 10_000 }, (_, i) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [((i * 37) % 3600) / 10 - 180, ((i * 53) % 1400) / 10 - 70],
      },
      properties: {
        id: `ac${i}`,
        familyId: families[i % families.length],
        bearing: (i * 29) % 360,
        sizeScale: 0.8,
        strobeOn: 0,
        primaryColor: LIVERIES[i % LIVERIES.length][0],
        secondaryColor: LIVERIES[i % LIVERIES.length][1],
      },
    }));
    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");
    const scriptTime = async () => {
      const { metrics } = await client.send("Performance.getMetrics");
      return metrics.find((m) => m.name === "ScriptDuration")?.value ?? 0;
    };
    const measure = async (trails: boolean) => {
      await page.evaluate(
        ({ trails, many }) => {
          const w = window as unknown as {
            harnessMap: import("maplibre-gl").Map;
            perfFeatures: unknown[];
            perfTimer?: number;
          };
          const map = w.harnessMap;
          for (const id of ["global-flight-trail", "flight-trail"]) {
            map.setLayoutProperty(id, "visibility", trails ? "visible" : "none");
          }
          map.jumpTo({ center: [10, 45], zoom: 5 });
          w.perfFeatures = many;
          let step = 0;
          clearInterval(w.perfTimer);
          w.perfTimer = window.setInterval(() => {
            step++;
            const moved = (w.perfFeatures as Array<{ geometry: { coordinates: number[] } }>).map(
              (f) => ({
                ...f,
                geometry: {
                  ...f.geometry,
                  coordinates: [f.geometry.coordinates[0] + step * 0.01, f.geometry.coordinates[1]],
                },
              }),
            );
            (map.getSource("global-flights") as import("maplibre-gl").GeoJSONSource).setData({
              type: "FeatureCollection",
              features: moved as never,
            });
          }, 200);
        },
        { trails, many },
      );
      await page.waitForTimeout(2_000);
      const before = await scriptTime();
      const frames = await page.evaluate(
        () =>
          new Promise<number[]>((resolve) => {
            const times: number[] = [];
            const start = performance.now();
            const tick = (now: number) => {
              times.push(now);
              if (now - start < 5_000) requestAnimationFrame(tick);
              else resolve(times);
            };
            requestAnimationFrame(tick);
          }),
      );
      const after = await scriptTime();
      const gaps = frames
        .slice(1)
        .map((t, i) => t - frames[i])
        .sort((a, b) => a - b);
      return {
        fps: Math.round((frames.length / 5) * 10) / 10,
        p95: Math.round(gaps[Math.floor(gaps.length * 0.95)] ?? 0),
        jsMsPerS: Math.round(((after - before) * 1000) / 5),
      };
    };
    // Alternate the cases so warm-up and drift hit both equally.
    const runs: Array<{ trails: boolean } & Awaited<ReturnType<typeof measure>>> = [];
    for (const trails of [false, true, true, false, false, true]) {
      runs.push({ trails, ...(await measure(trails)) });
    }
    const mean = (trails: boolean, key: "fps" | "p95" | "jsMsPerS") => {
      const values = runs.filter((r) => r.trails === trails).map((r) => r[key]);
      return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    };
    const summary = Object.fromEntries(
      (["fps", "p95", "jsMsPerS"] as const).map((k) => [
        k,
        { off: mean(false, k), on: mean(true, k) },
      ]),
    );
    console.log("S42 perf runs", JSON.stringify(runs));
    console.log("S42 perf mean", JSON.stringify(summary));
  });
});
