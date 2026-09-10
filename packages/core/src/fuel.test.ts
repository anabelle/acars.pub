import { describe, expect, it } from "vitest";
import { fp, fpSub, fpToNumber } from "./fixed-point.js";
import type { FixedPoint } from "./types.js";
import {
  FUEL_PRICE_MAX_PER_KG,
  FUEL_PRICE_MEAN_PER_KG,
  FUEL_PRICE_MIN_PER_KG,
  getFuelPriceAtTick,
  getFuelPriceHistory,
  stepFuelPrice,
} from "./fuel.js";

describe("fuel market", () => {
  it("returns the same price for the same tick", () => {
    expect(getFuelPriceAtTick(42)).toBe(getFuelPriceAtTick(42));
    expect(getFuelPriceAtTick(250_000)).toBe(getFuelPriceAtTick(250_000));
  });

  it("stays within configured bounds", () => {
    for (const tick of [0, 1, 12, 120, 10_000, 125_000, 980_000]) {
      const price = getFuelPriceAtTick(tick);
      expect(price).toBeGreaterThanOrEqual(FUEL_PRICE_MIN_PER_KG);
      expect(price).toBeLessThanOrEqual(FUEL_PRICE_MAX_PER_KG);
    }
  });

  it("starts at the configured mean", () => {
    expect(getFuelPriceAtTick(0)).toBe(FUEL_PRICE_MEAN_PER_KG);
  });

  it("returns ordered history ending at current tick", () => {
    const history = getFuelPriceHistory(1000, 8, 25);
    expect(history).toHaveLength(8);
    expect(history[0]?.tick).toBe(825);
    expect(history[history.length - 1]?.tick).toBe(1000);
  });

  it("mean reversion nudges extreme values back toward center", () => {
    const highStart = fp(1.55);
    const lowStart = fp(0.85);
    const highTick = Array.from({ length: 256 }, (_, tick) => tick).find(
      (tick) => stepFuelPrice(highStart, tick) < highStart,
    );
    const lowTick = Array.from({ length: 256 }, (_, tick) => tick).find(
      (tick) => stepFuelPrice(lowStart, tick) > lowStart,
    );

    expect(highTick).toBeDefined();
    expect(lowTick).toBeDefined();

    const fromHigh = stepFuelPrice(highStart, highTick ?? 0);
    const fromHighMean = stepFuelPrice(FUEL_PRICE_MEAN_PER_KG, highTick ?? 0);
    const fromLow = stepFuelPrice(lowStart, lowTick ?? 0);
    const fromLowMean = stepFuelPrice(FUEL_PRICE_MEAN_PER_KG, lowTick ?? 0);

    expect(fromHigh).toBeLessThan(highStart);
    expect(fromLow).toBeGreaterThan(lowStart);
    expect(fpToNumber(fpSub(fromHigh, fromHighMean))).toBeLessThan(
      fpToNumber(fpSub(highStart, FUEL_PRICE_MEAN_PER_KG)),
    );
    expect(fpToNumber(fpSub(fromLowMean, fromLow))).toBeLessThan(
      fpToNumber(fpSub(FUEL_PRICE_MEAN_PER_KG, lowStart)),
    );
  });
});

describe("getFuelPriceHistory", () => {
  it("appends a final sample when spacing does not land on currentTick", () => {
    // startTick clamps to 0 (gap too large), so the loop emits ticks that stop
    // before currentTick, triggering the final append branch.
    const samples = getFuelPriceHistory(100, 3, 120);
    const ticks = samples.map((s) => s.tick);
    expect(ticks[ticks.length - 1]).toBe(100);
    expect(samples.length).toBe(2);
    expect(ticks).toEqual([0, 100]);
  });

  it("does not duplicate the current tick when spacing lands on it", () => {
    const samples = getFuelPriceHistory(240, 3, 120);
    const ticks = samples.map((s) => s.tick);
    expect(ticks[ticks.length - 1]).toBe(240);
    expect(ticks).toEqual([0, 120, 240]);
  });

  it("clamps sample count and spacing to safe minimums", () => {
    const samples = getFuelPriceHistory(100, 0, 0);
    expect(samples.length).toBeGreaterThanOrEqual(2);
    expect(samples[0].tick).toBeGreaterThanOrEqual(0);
  });

  it("clamps a negative current tick to zero", () => {
    const samples = getFuelPriceHistory(-50, 2, 10);
    expect(samples.every((s) => s.tick >= 0)).toBe(true);
  });
});

describe("getFuelPriceAtTick memoization", () => {
  /** Naive reference: walk the OU series from tick 0 to `tick`. */
  function naiveFuelPrice(tick: number): FixedPoint {
    let price = FUEL_PRICE_MEAN_PER_KG;
    for (let t = 0; t < tick; t += 1) {
      price = stepFuelPrice(price, t);
    }
    return price;
  }

  it("returns values identical to the naive epoch-walk for t in 0..5000 (in order)", () => {
    // Walk the naive series incrementally (equivalent to re-walking from
    // tick 0 for every t) and compare every step.
    let naive = FUEL_PRICE_MEAN_PER_KG;
    for (let t = 0; t <= 5000; t += 1) {
      expect(getFuelPriceAtTick(t)).toBe(naive);
      naive = stepFuelPrice(naive, t);
    }
  });

  it("returns identical values for out-of-order (backward) queries", () => {
    // Prime the cache far forward, then jump backwards — the re-derive
    // path from the cached epoch start must reproduce the same prices.
    expect(getFuelPriceAtTick(4999)).toBe(naiveFuelPrice(4999));
    for (const t of [1234, 50, 4500, 7, 4999, 0, 2500]) {
      expect(getFuelPriceAtTick(t)).toBe(naiveFuelPrice(t));
    }
  });

  it("survives cache-bound resets across multi-epoch jumps", () => {
    // Jump ~3+ epochs ahead (forces a bound-triggered reset), then verify
    // a backward tick and a forward tick in a different epoch.
    const far = 3 * 28800 + 137;
    const expectedFar = naiveFuelPrice(far);
    expect(getFuelPriceAtTick(far)).toBe(expectedFar);

    const back = 28800 + 42;
    expect(getFuelPriceAtTick(back)).toBe(naiveFuelPrice(back));
    expect(getFuelPriceAtTick(far)).toBe(expectedFar);
    expect(getFuelPriceAtTick(far + 1)).toBe(naiveFuelPrice(far + 1));
  });

  it("clamps fractional and negative ticks like the naive walk", () => {
    expect(getFuelPriceAtTick(17.9)).toBe(naiveFuelPrice(17));
    expect(getFuelPriceAtTick(-3)).toBe(FUEL_PRICE_MEAN_PER_KG);
  });
});
