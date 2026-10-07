import { TICKS_PER_DAY } from "@acars/core";
import { describe, expect, it } from "vitest";
import { ABANDONED_AFTER_DAYS, isAbandonedAirline } from "./abandonedAirlines";

const NOW = 1_000 * TICKS_PER_DAY;
const LONG_AGO = NOW - (ABANDONED_AFTER_DAYS + 1) * TICKS_PER_DAY;

describe("isAbandonedAirline()", () => {
  it("is a routeless airline idle for more than a week", () => {
    expect(isAbandonedAirline([], LONG_AGO, NOW)).toBe(true);
    expect(isAbandonedAirline([{ status: "suspended" }], LONG_AGO, NOW)).toBe(true);
  });

  it("keeps anyone flying a route, however idle", () => {
    expect(isAbandonedAirline([{ status: "active" }], LONG_AGO, NOW)).toBe(false);
  });

  it("keeps recent airlines and those with unknown activity", () => {
    expect(isAbandonedAirline([], NOW - TICKS_PER_DAY, NOW)).toBe(false);
    expect(isAbandonedAirline([], NOW - ABANDONED_AFTER_DAYS * TICKS_PER_DAY, NOW)).toBe(false);
    expect(isAbandonedAirline([], null, NOW)).toBe(false);
    expect(isAbandonedAirline([], undefined, NOW)).toBe(false);
  });
});
