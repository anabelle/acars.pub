import { getAircraftById } from "@acars/data";
import { describe, expect, it } from "vitest";
import { blockHoursPerAircraftPerDay, IDLE_BLOCK_HOURS_PER_DAY } from "./routeSuggestion.js";

describe("blockHoursPerAircraftPerDay (S58)", () => {
  const atr = getAircraftById("atr72-600");
  if (!atr) throw new Error("atr72-600 missing from the catalog");

  it("an ATR on MAD–BCN at 7/wk is idle; at 46/wk it flies a real day", () => {
    const low = blockHoursPerAircraftPerDay(483, atr, 7, 1);
    const high = blockHoursPerAircraftPerDay(483, atr, 46, 1);
    expect(low).toBeLessThan(IDLE_BLOCK_HOURS_PER_DAY);
    expect(high).toBeGreaterThan(10);
    expect(high).toBeLessThanOrEqual(24);
  });

  it("shares the schedule across the planes and caps at what they can fly", () => {
    const one = blockHoursPerAircraftPerDay(483, atr, 28, 1);
    expect(blockHoursPerAircraftPerDay(483, atr, 28, 2)).toBeCloseTo(one / 2);
    expect(blockHoursPerAircraftPerDay(483, atr, 10_000, 1)).toBeLessThan(24);
    expect(blockHoursPerAircraftPerDay(483, atr, 7, 0)).toBe(0);
  });
});
