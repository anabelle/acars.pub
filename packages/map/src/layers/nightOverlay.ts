import type * as maplibregl from "maplibre-gl";
import { getSubsolarPoint } from "@acars/core";
import type { CityGlow, NightTint } from "../theme.js";

export const NIGHT_CANVAS_W = 1024;
export const NIGHT_CANVAS_H = 512;

/** Web Mercator max latitude (degrees) — matches canvas source coordinates */
const MERCATOR_MAX_LAT = 85.051129;
const DEG2RAD = Math.PI / 180;

/**
 * Pre-computed latitude (radians) for each canvas row — computed once at
 * module load so paintNightCanvas doesn't redo the inverse Mercator every call.
 */
const _yTop =
  (1 - Math.log(Math.tan(Math.PI / 4 + (MERCATOR_MAX_LAT * DEG2RAD) / 2)) / Math.PI) / 2;
const _yBot =
  (1 - Math.log(Math.tan(Math.PI / 4 - (MERCATOR_MAX_LAT * DEG2RAD) / 2)) / Math.PI) / 2;
const ROW_LAT_RAD = new Float32Array(NIGHT_CANVAS_H);
for (let _y = 0; _y < NIGHT_CANVAS_H; _y++) {
  const _y01 = _yTop + (_y / NIGHT_CANVAS_H) * (_yBot - _yTop);
  ROW_LAT_RAD[_y] = 2 * Math.atan(Math.exp((1 - 2 * _y01) * Math.PI)) - Math.PI / 2;
}

/** Pre-computed sin/cos for each canvas column longitude — also static. */
const COL_LNG_RAD = new Float32Array(NIGHT_CANVAS_W);
for (let _x = 0; _x < NIGHT_CANVAS_W; _x++) {
  COL_LNG_RAD[_x] = ((_x / NIGHT_CANVAS_W) * 360 - 180) * DEG2RAD;
}

/**
 * Paints a smooth night-side tint onto the canvas.
 *
 * For each pixel, computes the angular distance from the subsolar point
 * and maps it to an alpha value with a smooth transition through civil
 * twilight (sun altitude 0° to −6°, angular distance 90°–96°).
 *
 * The result is a dark blue-black wash that smoothly darkens the night
 * side without pixelation at any zoom level (it's a continuous gradient).
 */
/**
 * Paints a smooth night-side tint onto the canvas.
 *
 * Uses pre-computed per-row latitude and per-column longitude tables
 * (ROW_LAT_RAD / COL_LNG_RAD) so the expensive inverse-Mercator and
 * degree→radian conversions are done only once at module load, not every
 * 60-second repaint.
 */
export function paintNightCanvas(
  canvas: HTMLCanvasElement,
  subsolarLat: number,
  subsolarLng: number,
  nightTint: NightTint,
  lights?: { cities: readonly CityLight[]; glow: CityGlow },
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  const sunLatRad = subsolarLat * DEG2RAD;
  const sunLngRad = subsolarLng * DEG2RAD;

  // Angular distance thresholds (radians)
  const TERMINATOR = Math.PI / 2; // 90°
  const TWILIGHT_END = (96 * Math.PI) / 180; // 96°
  const TWILIGHT_RANGE = TWILIGHT_END - TERMINATOR;

  const maxAlpha255 = Math.round(nightTint.maxAlpha * 255);

  // Sun trig — constant for all pixels
  const sinSunLat = Math.sin(sunLatRad);
  const cosSunLat = Math.cos(sunLatRad);

  for (let y = 0; y < H; y++) {
    const latRad = ROW_LAT_RAD[y];
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const latTerm = sinLat * sinSunLat;
    const latCosTerm = cosLat * cosSunLat;
    const rowBase = y * W * 4;

    for (let x = 0; x < W; x++) {
      const dLng = COL_LNG_RAD[x] - sunLngRad;
      const cosD = latTerm + latCosTerm * Math.cos(dLng);
      const dist = Math.acos(cosD < -1 ? -1 : cosD > 1 ? 1 : cosD);

      let alpha: number;
      if (dist <= TERMINATOR) {
        alpha = 0;
      } else if (dist >= TWILIGHT_END) {
        alpha = maxAlpha255;
      } else {
        const t = (dist - TERMINATOR) / TWILIGHT_RANGE;
        const s = t * t * (3 - 2 * t);
        alpha = (s * maxAlpha255 + 0.5) | 0;
      }

      const idx = rowBase + x * 4;
      data[idx] = nightTint.r;
      data[idx + 1] = nightTint.g;
      data[idx + 2] = nightTint.b;
      data[idx + 3] = alpha;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  if (lights) paintCityLights(ctx, W, H, lights.cities, subsolarLat, subsolarLng, lights.glow);
}

/** A city on the night canvas (S76): canvas position (0–1) and brightness (0–1). */
export interface CityLight {
  x01: number;
  y01: number;
  lat: number;
  lng: number;
  weight: number;
}

type CitySource = {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  population: number;
};

/**
 * The cities that light up at night (S76): one light per city (its largest
 * metro population), the `max` biggest, brightness on a log scale from 100k
 * (dim) to 30M (brightest). Computed once per airport catalog.
 */
export function cityLights(airports: readonly CitySource[], max = 900): CityLight[] {
  const byCity = new Map<string, CitySource>();
  for (const airport of airports) {
    if (!(airport.population > 0) || Math.abs(airport.latitude) > MERCATOR_MAX_LAT) continue;
    const key = `${airport.country}|${airport.city}`;
    const seen = byCity.get(key);
    if (!seen || airport.population > seen.population) byCity.set(key, airport);
  }
  return [...byCity.values()]
    .sort((a, b) => b.population - a.population || a.city.localeCompare(b.city))
    .slice(0, max)
    .map((a) => {
      const latRad = a.latitude * DEG2RAD;
      const y = (1 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / Math.PI) / 2;
      const weight = (Math.log10(a.population) - 5) / (Math.log10(30_000_000) - 5);
      return {
        x01: (a.longitude + 180) / 360,
        y01: (y - _yTop) / (_yBot - _yTop),
        lat: a.latitude,
        lng: a.longitude,
        weight: Math.min(1, Math.max(0.12, weight)),
      };
    });
}

/**
 * How dark it is at a point, 0 (sun up) to 1 (night): lights switch on
 * through twilight, from the sun 2° below the horizon to 10° below.
 */
export function nightFactor(
  lat: number,
  lng: number,
  subsolarLat: number,
  subsolarLng: number,
): number {
  const cosD =
    Math.sin(lat * DEG2RAD) * Math.sin(subsolarLat * DEG2RAD) +
    Math.cos(lat * DEG2RAD) *
      Math.cos(subsolarLat * DEG2RAD) *
      Math.cos((lng - subsolarLng) * DEG2RAD);
  const dist = Math.acos(Math.min(1, Math.max(-1, cosD))) / DEG2RAD;
  const t = Math.min(1, Math.max(0, (dist - 92) / 8));
  return t * t * (3 - 2 * t);
}

function paintCityLights(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cities: readonly CityLight[],
  subsolarLat: number,
  subsolarLng: number,
  glow: CityGlow,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const city of cities) {
    const dark = nightFactor(city.lat, city.lng, subsolarLat, subsolarLng);
    if (dark <= 0) continue;
    const r = 0.9 + 2.6 * city.weight;
    const alpha = glow.maxAlpha * dark * (0.35 + 0.65 * city.weight);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    gradient.addColorStop(0, `rgba(${glow.r},${glow.g},${glow.b},${alpha.toFixed(3)})`);
    gradient.addColorStop(0.35, `rgba(${glow.r},${glow.g},${glow.b},${(alpha * 0.45).toFixed(3)})`);
    gradient.addColorStop(1, `rgba(${glow.r},${glow.g},${glow.b},0)`);
    // The canvas spans a Mercator square at 2:1, so a canvas pixel is twice
    // as tall as it is wide: squash the glow vertically to keep it round.
    ctx.setTransform(1, 0, 0, H / W, city.x01 * W, city.y01 * H);
    ctx.fillStyle = gradient;
    ctx.fillRect(-r, -r, r * 2, r * 2);
  }
  ctx.restore();
}

export const NIGHT_CANVAS_SOURCE = "night-canvas";
export const NIGHT_CANVAS_LAYER = "night-canvas-layer";

/**
 * Adds the day/night overlay: a canvas source painted with the current
 * terminator and the raster layer that draws it. Returns the canvas so the
 * caller can repaint it as the sun moves.
 */
export function addNightOverlay(
  map: maplibregl.Map,
  nightTint: NightTint,
  lights?: { cities: readonly CityLight[]; glow: CityGlow },
): HTMLCanvasElement {
  // --- Night canvas source (smooth solar gradient) ---
  const nightCanvas = document.createElement("canvas");
  nightCanvas.width = NIGHT_CANVAS_W;
  nightCanvas.height = NIGHT_CANVAS_H;

  // Paint immediately
  const sun = getSubsolarPoint(new Date());
  paintNightCanvas(nightCanvas, sun.lat, sun.lng, nightTint, lights);

  map.addSource(NIGHT_CANVAS_SOURCE, {
    type: "canvas",
    canvas: nightCanvas,
    // Corners: top-left, top-right, bottom-right, bottom-left. (Before S76 the
    // last corner repeated the top-left, folding the quad into a triangle, so
    // half the night side was never drawn.)
    coordinates: [
      [-180, MERCATOR_MAX_LAT],
      [180, MERCATOR_MAX_LAT],
      [180, -MERCATOR_MAX_LAT],
      [-180, -MERCATOR_MAX_LAT],
    ],
    // Static texture: animate:true made maplibre repaint every frame and
    // re-upload the 1024x512 RGBA texture (~2 MB) at 60fps even though the
    // terminator only changes every 60s (it starved the UI and eventually
    // killed WebGL contexts). updateNightOverlay pulses play()/pause() to
    // upload a fresh texture after each repaint.
    animate: false,
  });
  map.addLayer({
    id: NIGHT_CANVAS_LAYER,
    type: "raster",
    source: NIGHT_CANVAS_SOURCE,
    paint: {
      "raster-opacity": 1.0,
      "raster-resampling": "linear",
      "raster-fade-duration": 0,
    },
  });
  return nightCanvas;
}
