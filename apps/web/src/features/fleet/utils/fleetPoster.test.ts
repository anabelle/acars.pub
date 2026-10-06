import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coverCrop,
  drawFleetPoster,
  layoutFleetPoster,
  loadPosterImages,
  POSTER_FORMATS,
  type PosterContext,
  type PosterFormat,
  type PosterInput,
  posterFileName,
  STAT_LINE_GAP,
} from "./fleetPoster";

function recorder() {
  const calls: unknown[] = [];
  const ctx = {
    fillStyle: "",
    font: "",
    textBaseline: "alphabetic",
    fillRect: (...a: unknown[]) => calls.push(["fillRect", ctx.fillStyle, ...a]),
    fillText: (...a: unknown[]) => calls.push(["fillText", ctx.fillStyle, ctx.font, ...a]),
    drawImage: (...a: unknown[]) => calls.push(["drawImage", ...a.slice(1)]),
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
  } as unknown as PosterContext;
  return { ctx, calls };
}

const input: PosterInput = {
  airlineName: "Iberia Express Test",
  icaoCode: "IBX",
  colors: { primary: "#c8102e", secondary: "#ffffff", accent: "#ffcc00" },
  stats: [
    { label: "Aircraft", value: "12" },
    { label: "Routes", value: "9" },
    { label: "Tier", value: "2" },
  ],
  liveries: Array.from({ length: 12 }, (_, i) => ({ name: `Ship ${i + 1}`, imageUrl: null })),
  footer: "Flying on acars.pub",
};

describe("layoutFleetPoster()", () => {
  for (const format of Object.keys(POSTER_FORMATS) as PosterFormat[]) {
    it(`${format}: cells fill the grid inside the poster, below the header`, () => {
      const layout = layoutFleetPoster(format);
      const { width, height, columns, rows } = POSTER_FORMATS[format];
      expect([layout.width, layout.height]).toEqual([width, height]);
      expect(layout.cells).toHaveLength(columns * rows);
      for (const cell of layout.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeGreaterThanOrEqual(layout.band.h);
        expect(cell.x + cell.w).toBeLessThanOrEqual(width);
        expect(cell.y + cell.h).toBeLessThan(layout.footer.y);
        expect(cell.w).toBeGreaterThan(100);
        expect(cell.h).toBeGreaterThan(80);
      }
      expect(layout.stats).toHaveLength(3);
      // Header doesn't overlap: stat values start below the subtitle, inside the band.
      for (const stat of layout.stats) {
        const valueTop = stat.y - stat.labelSize - STAT_LINE_GAP - stat.valueSize;
        expect(valueTop).toBeGreaterThan(layout.subtitle.y);
        expect(stat.y).toBeLessThan(layout.band.h);
      }
      expect(layout.band.h).toBeLessThan(height * 0.45);
    });
  }
});

describe("drawFleetPoster()", () => {
  it("renders identically every time, at both sizes", () => {
    for (const format of ["portrait", "landscape"] as const) {
      const layout = layoutFleetPoster(format);
      const a = recorder();
      const b = recorder();
      drawFleetPoster(a.ctx, layout, input, []);
      drawFleetPoster(b.ctx, layoutFleetPoster(format), input, []);
      expect(b.calls).toEqual(a.calls);
      // One tile per cell (extra liveries are left out), plus name and stats.
      const tiles = a.calls.filter(
        (c) => (c as unknown[])[0] === "fillText" && (c as unknown[])[3] === "✈",
      );
      expect(tiles).toHaveLength(layout.cells.length);
      expect(a.calls).toContainEqual(
        expect.arrayContaining(["fillText", "#ffffff", expect.any(String), "Iberia Express Test"]),
      );
    }
  });

  it("draws loaded images cover-cropped and skips missing stats and liveries", () => {
    const layout = layoutFleetPoster("landscape");
    const { ctx, calls } = recorder();
    const image = { source: {} as CanvasImageSource, width: 1600, height: 900 };
    drawFleetPoster(
      ctx,
      layout,
      { ...input, stats: input.stats.slice(0, 1), liveries: input.liveries.slice(0, 2) },
      [image, null],
    );
    const draws = calls.filter((c) => (c as unknown[])[0] === "drawImage");
    expect(draws).toHaveLength(1);
    const cell = layout.cells[0];
    expect((draws[0] as number[]).slice(5)).toEqual([cell.x, cell.y, cell.w, cell.h]);
    expect(calls.filter((c) => (c as unknown[])[3] === "AIRCRAFT")).toHaveLength(1);
    expect(calls.filter((c) => (c as unknown[])[3] === "ROUTES")).toHaveLength(0);
  });
});

describe("coverCrop()", () => {
  it("centre-crops without distortion", () => {
    const crop = coverCrop({ width: 200, height: 100 }, { w: 100, h: 100 });
    expect(crop).toEqual({ sx: 50, sy: 0, sw: 100, sh: 100 });
    expect(crop.sw / crop.sh).toBeCloseTo(1, 10);
  });
});

describe("posterFileName()", () => {
  it("slugs the airline and names the size", () => {
    expect(posterFileName("Iberia Express!", "portrait")).toBe(
      "iberia-express-fleet-1080x1350.png",
    );
    expect(posterFileName("★★", "landscape")).toBe("airline-fleet-1200x630.png");
  });
});

describe("loadPosterImages()", () => {
  const original = globalThis.Image;
  afterEach(() => {
    globalThis.Image = original;
  });

  it("loads CORS-clean images and turns failures into null", async () => {
    class FakeImage {
      crossOrigin = "";
      naturalWidth = 640;
      naturalHeight = 480;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(url: string) {
        queueMicrotask(() => (url.includes("bad") ? this.onerror?.() : this.onload?.()));
      }
    }
    globalThis.Image = FakeImage as never;
    const result = await loadPosterImages(["https://ok/a.png", "https://bad/b.png", null]);
    expect(result[0]).toMatchObject({ width: 640, height: 480 });
    expect((result[0]?.source as unknown as FakeImage).crossOrigin).toBe("anonymous");
    expect(result.slice(1)).toEqual([null, null]);
    vi.restoreAllMocks();
  });
});
