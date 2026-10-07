import { fp } from "@acars/core";
import { describe, expect, it } from "vitest";
import {
  FIRST_HOP_MAX_HOURS,
  flightHours,
  rankByProfitPerDay,
  rankForFirstRoute,
} from "./opportunityRanking";

describe("rankByProfitPerDay", () => {
  it("puts the most profitable market first and unprojectable ones last", () => {
    const profits: Record<string, number | null> = { A: 100, B: null, C: 900, D: -50, E: null };
    const ranked = rankByProfitPerDay(Object.keys(profits), (m) =>
      profits[m] === null ? null : fp(profits[m] as number),
    );
    expect(ranked.map((r) => r.market)).toEqual(["C", "A", "D", "B", "E"]);
    expect(ranked[0].profitPerDay).toBe(fp(900));
    expect(ranked[3].profitPerDay).toBeNull();
  });

  it("keeps the original order on ties", () => {
    const ranked = rankByProfitPerDay(["x", "y", "z"], () => fp(10));
    expect(ranked.map((r) => r.market)).toEqual(["x", "y", "z"]);
  });
});

describe("rankForFirstRoute()", () => {
  const entry = (id: string, profit: number | null, hours: number | null) => ({
    id,
    profitPerDay: profit === null ? null : fp(profit),
    hours,
  });

  it("puts profitable short hops first, keeping the profit order in each group", () => {
    const ranked = [
      entry("long-rich", 9000, 7),
      entry("short-a", 3000, 1.2),
      entry("loss-short", -100, 1),
      entry("short-b", 2000, FIRST_HOP_MAX_HOURS),
      entry("no-model", null, null),
    ];
    expect(rankForFirstRoute(ranked, (e) => e.hours).map((e) => e.id)).toEqual([
      "short-a",
      "short-b",
      "long-rich",
      "loss-short",
      "no-model",
    ]);
  });

  it("leaves the order alone when nothing qualifies", () => {
    const ranked = [entry("a", 100, 5), entry("b", 50, 3)];
    expect(rankForFirstRoute(ranked, (e) => e.hours).map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("flightHours()", () => {
  it("divides distance by cruise speed, defaulting to 800 km/h", () => {
    expect(flightHours(1600, 800)).toBe(2);
    expect(flightHours(400, undefined)).toBe(0.5);
  });
});
