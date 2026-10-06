import type * as maplibregl from "maplibre-gl";
import { getSubsolarPoint } from "@acars/core";
import type { NightTint } from "../theme.js";

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
}

export const NIGHT_CANVAS_SOURCE = "night-canvas";
export const NIGHT_CANVAS_LAYER = "night-canvas-layer";

/**
 * Adds the day/night overlay: a canvas source painted with the current
 * terminator and the raster layer that draws it. Returns the canvas so the
 * caller can repaint it as the sun moves.
 */
export function addNightOverlay(map: maplibregl.Map, nightTint: NightTint): HTMLCanvasElement {
  // --- Night canvas source (smooth solar gradient) ---
  const nightCanvas = document.createElement("canvas");
  nightCanvas.width = NIGHT_CANVAS_W;
  nightCanvas.height = NIGHT_CANVAS_H;

  // Paint immediately
  const sun = getSubsolarPoint(new Date());
  paintNightCanvas(nightCanvas, sun.lat, sun.lng, nightTint);

  map.addSource(NIGHT_CANVAS_SOURCE, {
    type: "canvas",
    canvas: nightCanvas,
    coordinates: [
      [-180, 85.051129],
      [180, 85.051129],
      [180, -85.051129],
      [-180, 85.051129],
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
