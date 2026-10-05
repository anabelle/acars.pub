import { fp } from "@acars/core";
import { describe, expect, it } from "vitest";
import { rankByProfitPerDay } from "./opportunityRanking";

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
