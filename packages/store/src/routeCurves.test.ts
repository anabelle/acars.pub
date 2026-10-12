import { getAircraftById, setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { beforeAll, describe, expect, it } from "vitest";
import { FARE_STEPS, fareCurve, frequencyCurve } from "./routeCurves.js";

beforeAll(() => setAirportsCatalog(airports));

const model = getAircraftById("atr72-600");
const input = () => {
  if (!model) throw new Error("atr72-600 missing");
  return {
    originIata: "MAD",
    destinationIata: "BCN",
    distanceKm: 483,
    model,
    tick: 1000,
    frequencyPerWeek: 7,
    networkRoutes: [{ originIata: "MAD", destinationIata: "BCN", frequencyPerWeek: 7 }],
  };
};

describe("route what-if curves (S64)", () => {
  it("samples frequency from 1 to the operating maximum, with the best and the current", () => {
    const curve = frequencyCurve(input());
    const xs = curve.points.map((p) => p.x);
    expect(xs[0]).toBe(1);
    expect(xs.at(-1)).toBe(curve.max);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(xs).toContain(7);
    expect(curve.current).toBe(7);
    const best = curve.points.find((p) => p.x === curve.best);
    for (const p of curve.points)
      expect(p.profitPerDay).toBeLessThanOrEqual(best?.profitPerDay ?? 0);
    expect(curve.best).toBeGreaterThan(7);
  });

  it("samples fares from 60 % to 160 %, fuller when cheaper", () => {
    const curve = fareCurve(input());
    expect(curve.points.map((p) => p.x)).toEqual([...FARE_STEPS]);
    expect(curve.current).toBe(1);
    expect(curve.points[0].loadFactor).toBeGreaterThanOrEqual(curve.points.at(-1)?.loadFactor ?? 1);
  });

  it("is deterministic", () => {
    expect(frequencyCurve(input())).toEqual(frequencyCurve(input()));
  });
});
