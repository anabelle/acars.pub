import { describe, expect, it } from "vitest";
import {
  bankQuality,
  CONNECT_SHARE,
  connectingDemand,
  detourFactor,
  MAX_CONNECT_TICKS,
  MIN_CONNECT_TICKS,
} from "./connections.js";
import { TICKS_PER_DAY, TICKS_PER_HOUR } from "./types.js";

const H = TICKS_PER_HOUR;

describe("detourFactor", () => {
  it("is 1 on the way and 0 past a 50 % detour", () => {
    expect(detourFactor(1000, 500, 500)).toBe(1);
    expect(detourFactor(1000, 600, 650)).toBeCloseTo(0.5);
    expect(detourFactor(1000, 900, 700)).toBe(0);
    expect(detourFactor(0, 1, 1)).toBe(0);
  });
});

describe("bankQuality", () => {
  it("is 0.5 at random and 1 for a perfect bank", () => {
    expect(bankQuality([], [8 * H])).toBe(0.5);
    expect(bankQuality([7 * H, 7.5 * H], [8.5 * H])).toBe(1);
    expect(bankQuality([7 * H, 12 * H], [8 * H])).toBe(0.75);
  });

  it("respects the minimum and maximum connection and wraps midnight", () => {
    expect(bankQuality([10 * H], [10 * H + MIN_CONNECT_TICKS - 1])).toBe(0.5);
    expect(bankQuality([10 * H], [10 * H + MAX_CONNECT_TICKS + 1])).toBe(0.5);
    expect(bankQuality([23.5 * H], [(0.75 * H) % TICKS_PER_DAY])).toBe(1);
  });
});

describe("connectingDemand", () => {
  it("takes the share scaled by detour and quality", () => {
    const market = { economy: 1000, business: 100, first: 20 };
    expect(connectingDemand(market, 1, 1)).toEqual({
      economy: 1000 * CONNECT_SHARE,
      business: 100 * CONNECT_SHARE,
      first: Math.round(20 * CONNECT_SHARE),
    });
    expect(connectingDemand(market, 0, 1).economy).toBe(0);
    expect(connectingDemand(market, 1, 0.5).economy).toBe(75);
  });
});
