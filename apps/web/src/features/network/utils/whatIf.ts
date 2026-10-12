import type { Curve } from "@acars/store";

export const CHART_W = 300;
export const CHART_H = 96;
const PAD = { left: 6, right: 6, top: 10, bottom: 14 };

export interface PlottedPoint {
  x: number;
  profitPerDay: number;
  loadFactor: number;
  share: number;
  px: number;
  py: number;
}

export interface PlottedCurve {
  points: PlottedPoint[];
  path: string;
  /** Pixel y of zero profit, or null when the whole curve is on one side. */
  zeroY: number | null;
  xToPx: (x: number) => number;
}

/** Lays a what-if curve into the chart box (S64): x linear, y from min to max profit. */
export function plotCurve(curve: Curve): PlottedCurve {
  const xs = curve.points.map((p) => p.x);
  const ys = curve.points.map((p) => p.profitPerDay);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs, xMin + 1e-9);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 0);
  const ySpan = yMax - yMin || 1;
  const xToPx = (x: number) =>
    PAD.left + ((x - xMin) / (xMax - xMin || 1)) * (CHART_W - PAD.left - PAD.right);
  const yToPx = (y: number) =>
    PAD.top + (1 - (y - yMin) / ySpan) * (CHART_H - PAD.top - PAD.bottom);
  const points = curve.points.map((p) => ({ ...p, px: xToPx(p.x), py: yToPx(p.profitPerDay) }));
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.px.toFixed(1)} ${p.py.toFixed(1)}`)
    .join(" ");
  const zeroY = yMin < 0 && yMax > 0 ? yToPx(0) : null;
  return { points, path, zeroY, xToPx };
}

/** The plotted point nearest a pixel x (hover and tap). */
export function nearestPoint(points: readonly PlottedPoint[], px: number): PlottedPoint {
  return points.reduce((best, p) => (Math.abs(p.px - px) < Math.abs(best.px - px) ? p : best));
}

/** The point at an x value (the curve always samples best and current). */
export function pointAt(points: readonly PlottedPoint[], x: number): PlottedPoint | undefined {
  return points.find((p) => p.x === x);
}
