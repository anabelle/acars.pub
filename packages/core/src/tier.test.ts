import { describe, expect, it } from "vitest";
import { fp } from "./fixed-point";
import {
  estimateHistoricRevenue,
  evaluateTier,
  getMaxHubs,
  getMaxRouteDistanceKm,
  TIER_THRESHOLDS,
} from "./tier";

describe("tier progression", () => {
  it("keeps tier when requirements are unmet", () => {
    const tier = evaluateTier(1, fp(1_000_000), 1);
    expect(tier).toBe(1);
  });

  it("breaks on active route count even when revenue threshold is met", () => {
    // Revenue meets tier-2 (5M) but only 1 active route (< 3) → break, stays 1.
    const tier = evaluateTier(1, fp(5_000_000), 1);
    expect(tier).toBe(1);
  });

  it("promotes to tier 2 when thresholds met", () => {
    const { minCumulativeRevenue, minActiveRoutes } = TIER_THRESHOLDS[2];
    const tier = evaluateTier(1, minCumulativeRevenue, minActiveRoutes);
    expect(tier).toBe(2);
  });

  it("promotes to tier 3 when thresholds met", () => {
    const { minCumulativeRevenue, minActiveRoutes } = TIER_THRESHOLDS[3];
    const tier = evaluateTier(2, minCumulativeRevenue, minActiveRoutes);
    expect(tier).toBe(3);
  });

  it("promotes multiple tiers when thresholds are met", () => {
    const tier = evaluateTier(1, fp(60_000_000), 12);
    expect(tier).toBe(3);
  });

  it("keeps tier when already above thresholds", () => {
    const tier = evaluateTier(4, fp(500_000_000), 40);
    expect(tier).toBe(4);
  });

  it("does not regress tiers when thresholds fall below", () => {
    const tier = evaluateTier(4, fp(1_000_000), 0);
    expect(tier).toBe(4);
  });
});

describe("tier limits", () => {
  it("returns distance limits by tier", () => {
    expect(getMaxRouteDistanceKm(1)).toBe(3000);
    expect(getMaxRouteDistanceKm(2)).toBe(7000);
    expect(getMaxRouteDistanceKm(3)).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns hub limits by tier", () => {
    expect(getMaxHubs(1)).toBe(1);
    expect(getMaxHubs(2)).toBe(3);
    expect(getMaxHubs(3)).toBe(5);
    expect(getMaxHubs(4)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("estimateHistoricRevenue", () => {
  it("returns zero for an empty fleet regardless of routes", () => {
    expect(
      estimateHistoricRevenue(
        [],
        [{ id: "r1", status: "active" } as never, { id: "r2", status: "active" } as never],
      ),
    ).toBe(fp(0));
  });

  it("sums the purchase price of every aircraft", () => {
    const fleet = [
      { id: "a1", purchasePrice: fp(50_000_000) } as never,
      { id: "a2", purchasePrice: fp(30_000_000) } as never,
      { id: "a3", purchasePrice: undefined } as never,
    ];
    expect(estimateHistoricRevenue(fleet, [])).toBe(fp(80_000_000));
  });

  it("adds a route bonus capped at 25 active routes ($2M each)", () => {
    const fleet = [{ id: "a1", purchasePrice: fp(10_000_000) } as never];
    const routes = Array.from({ length: 40 }, (_, i) => ({
      id: `r${i}`,
      status: "active",
    })) as never;
    // 25 * 2_000_000 = 50_000_000 ; total = 60_000_000
    expect(estimateHistoricRevenue(fleet, routes)).toBe(fp(60_000_000));
  });

  it("ignores inactive routes when computing the bonus", () => {
    const fleet = [{ id: "a1", purchasePrice: fp(10_000_000) } as never];
    const routes = [
      { id: "r1", status: "active" } as never,
      { id: "r2", status: "closed" } as never,
      { id: "r3", status: "pending" } as never,
    ];
    // 1 active route → 2_000_000 bonus ; total = 12_000_000
    expect(estimateHistoricRevenue(fleet, routes)).toBe(fp(12_000_000));
  });
});
