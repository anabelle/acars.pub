import { describe, expect, it } from "vitest";
import { CHART_H, CHART_W, nearestPoint, plotCurve, pointAt } from "./whatIf";

const curve = {
  points: [
    { x: 1, profitPerDay: -500, loadFactor: 0.9, share: 0.1 },
    { x: 7, profitPerDay: 2000, loadFactor: 0.8, share: 0.4 },
    { x: 14, profitPerDay: 1000, loadFactor: 0.6, share: 0.6 },
  ],
  best: 7,
  current: 14,
  max: 14,
};

describe("plotCurve", () => {
  it("fits the curve in the box with the best point highest", () => {
    const plot = plotCurve(curve);
    for (const p of plot.points) {
      expect(p.px).toBeGreaterThanOrEqual(0);
      expect(p.px).toBeLessThanOrEqual(CHART_W);
      expect(p.py).toBeGreaterThanOrEqual(0);
      expect(p.py).toBeLessThanOrEqual(CHART_H);
    }
    const best = pointAt(plot.points, 7);
    expect(Math.min(...plot.points.map((p) => p.py))).toBe(best?.py);
    expect(plot.path.startsWith("M")).toBe(true);
    expect(plot.zeroY).not.toBeNull();
  });

  it("has no zero line when the curve never crosses zero", () => {
    const plot = plotCurve({
      ...curve,
      points: curve.points.map((p) => ({ ...p, profitPerDay: p.profitPerDay + 1000 })),
    });
    expect(plot.zeroY).toBeNull();
  });

  it("finds the nearest point to a pixel", () => {
    const plot = plotCurve(curve);
    expect(nearestPoint(plot.points, 0).x).toBe(1);
    expect(nearestPoint(plot.points, CHART_W).x).toBe(14);
    expect(nearestPoint(plot.points, plot.xToPx(8)).x).toBe(7);
  });
});
