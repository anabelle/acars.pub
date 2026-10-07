import { describe, expect, it, vi } from "vitest";
import { fp, fpSub, fpToNumber } from "./fixed-point.js";
import {
  FUEL_PRICE_EPOCH_TICKS,
  FUEL_PRICE_MAX_PER_KG,
  FUEL_PRICE_MEAN_PER_KG,
  FUEL_PRICE_MIN_PER_KG,
  getFuelPriceAtTick,
  getFuelPriceHistory,
  stepFuelPrice,
} from "./fuel.js";
import { FUEL_EPOCH_START_PRICES } from "./fuelEpochs.js";
import { type FixedPoint, GENESIS_TIME, TICK_DURATION } from "./types.js";

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

describe("getFuelPriceAtTick past the Map size limit", () => {
  // Regression: the first lookup of a session walks from tick 0 to "now".
  // Caching every intermediate tick overflowed the Map's 2^24-entry limit once
  // the game clock passed ~16.8M ticks (late Sept 2026), throwing
  // "RangeError: Map maximum size exceeded" at every landing and on the
  // Finance page. A fresh module must answer for a tick beyond 2^24.
  it("answers a cold lookup beyond 2^24 ticks without throwing", { timeout: 120_000 }, async () => {
    vi.resetModules();
    const fresh = await import("./fuel.js");
    const tick = 2 ** 24 + 166_000;
    const price = fresh.getFuelPriceAtTick(tick);
    expect(price).toBeGreaterThanOrEqual(FUEL_PRICE_MIN_PER_KG);
    expect(price).toBeLessThanOrEqual(FUEL_PRICE_MAX_PER_KG);
    // Consistent with the per-tick random walk: price(t) = step(price(t-1), t-1).
    expect(fresh.stepFuelPrice(fresh.getFuelPriceAtTick(tick - 1), tick - 1)).toBe(
      fresh.getFuelPriceAtTick(tick),
    );
  });
});

describe("precomputed day-start prices (fuelEpochs.ts)", () => {
  /** Walks one engine day from its start price, exactly like the game. */
  const walkDay = (startPrice: number, epoch: number) => {
    let price = startPrice as FixedPoint;
    for (let t = epoch * FUEL_PRICE_EPOCH_TICKS; t < (epoch + 1) * FUEL_PRICE_EPOCH_TICKS; t++) {
      price = stepFuelPrice(price, t);
    }
    return price;
  };

  it("starts at the mean and chains day to day like the walk", () => {
    expect(FUEL_EPOCH_START_PRICES[0]).toBe(FUEL_PRICE_MEAN_PER_KG);
    const last = FUEL_EPOCH_START_PRICES.length - 2;
    // Every entry is checked by scripts/generate-fuel-epochs.ts --check; here,
    // a spread of days including the first and the last.
    for (const epoch of [0, 1, 2, 100, 333, 591, 600, 900, last]) {
      expect(walkDay(FUEL_EPOCH_START_PRICES[epoch], epoch)).toBe(
        FUEL_EPOCH_START_PRICES[epoch + 1],
      );
    }
  });

  it("covers the game clock through 2028", () => {
    const days = FUEL_EPOCH_START_PRICES.length;
    expect(GENESIS_TIME + days * FUEL_PRICE_EPOCH_TICKS * TICK_DURATION).toBeGreaterThan(
      Date.parse("2028-12-30T00:00:00Z"),
    );
  });

  it("walks on from the last precomputed day for dates past the table", async () => {
    vi.resetModules();
    const fresh = await import("./fuel.js");
    const lastDay = FUEL_EPOCH_START_PRICES.length - 1;
    // Two days past the table, a few ticks in.
    const tick = (lastDay + 2) * FUEL_PRICE_EPOCH_TICKS + 5;
    let expected = FUEL_EPOCH_START_PRICES[lastDay] as FixedPoint;
    for (let t = lastDay * FUEL_PRICE_EPOCH_TICKS; t < tick; t++)
      expected = stepFuelPrice(expected, t);
    expect(fresh.getFuelPriceAtTick(tick)).toBe(expected);
  });

  it("answers a cold lookup in late 2026 without walking from genesis", async () => {
    vi.resetModules();
    const fresh = await import("./fuel.js");
    const tick = Math.floor((Date.parse("2026-10-07T12:00:00Z") - GENESIS_TIME) / TICK_DURATION);
    const started = performance.now();
    const price = fresh.getFuelPriceAtTick(tick);
    // At most one day's walk (28,800 steps), not ~17M.
    expect(performance.now() - started).toBeLessThan(1_000);
    const epoch = Math.floor(tick / FUEL_PRICE_EPOCH_TICKS);
    let expected = FUEL_EPOCH_START_PRICES[epoch] as FixedPoint;
    for (let t = epoch * FUEL_PRICE_EPOCH_TICKS; t < tick; t++)
      expected = stepFuelPrice(expected, t);
    expect(price).toBe(expected);
  });
});

describe("world-sync access pattern (per-day checkpoints)", () => {
  /** Reference: walk from the precomputed start of the tick's day. */
  const reference = (tick: number) => {
    const epoch = Math.floor(tick / FUEL_PRICE_EPOCH_TICKS);
    let price = FUEL_EPOCH_START_PRICES[epoch] as FixedPoint;
    for (let t = epoch * FUEL_PRICE_EPOCH_TICKS; t < tick; t++) price = stepFuelPrice(price, t);
    return price;
  };

  it("answers lookups jumping back and forth across days exactly", async () => {
    vi.resetModules();
    const fresh = await import("./fuel.js");
    const base = 590 * FUEL_PRICE_EPOCH_TICKS;
    const ticks = [
      base + 7,
      base + 5 * FUEL_PRICE_EPOCH_TICKS + 29,
      base + 30,
      base + 2 * FUEL_PRICE_EPOCH_TICKS + 12_345,
      base + 31,
      base + 5 * FUEL_PRICE_EPOCH_TICKS + 30,
      base + FUEL_PRICE_EPOCH_TICKS - 1,
      base + 7,
    ];
    for (const tick of ticks) expect(fresh.getFuelPriceAtTick(tick)).toBe(reference(tick));
  });

  it("prices many rivals' missed landings over a week quickly", async () => {
    vi.resetModules();
    const fresh = await import("./fuel.js");
    const now = 600 * FUEL_PRICE_EPOCH_TICKS;
    const started = performance.now();
    // 20 rivals × 3 aircraft, each swept chronologically over 7 days (every ~2h).
    for (let rival = 0; rival < 20; rival++) {
      for (let ac = 0; ac < 3; ac++) {
        for (let t = now - 7 * FUEL_PRICE_EPOCH_TICKS + rival * 37 + ac; t < now; t += 2400) {
          fresh.getFuelPriceAtTick(t);
        }
      }
    }
    // Was ~20 s with the single-window tick cache (re-walked on every backward jump).
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
