import { describe, expect, it } from "vitest";
import { fp, fpSum, fpToNumber } from "./fixed-point.js";
import {
  isMilestoneMet,
  MILESTONES,
  type MilestoneState,
  milestoneProgress,
  milestoneState,
  newlyMetMilestones,
  nextMilestones,
} from "./milestones.js";
import { TIER_THRESHOLDS } from "./tier.js";

const empty: MilestoneState = {
  activeRoutes: 0,
  cumulativeRevenue: 0,
  fleetSize: 0,
  ownedAircraft: 0,
  jets: 0,
  widebodies: 0,
  hubs: 1,
  brandScore: 0.5,
};

const byId = (id: string) => {
  const milestone = MILESTONES.find((m) => m.id === id);
  if (!milestone) throw new Error(id);
  return milestone;
};

describe("MILESTONES table", () => {
  it("has unique ids and positive targets and rewards", () => {
    expect(new Set(MILESTONES.map((m) => m.id)).size).toBe(MILESTONES.length);
    for (const milestone of MILESTONES) {
      expect(milestone.target).toBeGreaterThan(0);
      expect(milestone.reward).toBeGreaterThan(0);
    }
  });

  it("keeps rewards small next to the revenue they mark", () => {
    const total = fpSum(MILESTONES.map((m) => m.reward));
    expect(fpToNumber(total)).toBeLessThan(fpToNumber(TIER_THRESHOLDS[4].minCumulativeRevenue) / 5);
  });

  it("puts rungs between every tier", () => {
    const revenueRungs = MILESTONES.filter((m) => m.metric === "cumulativeRevenue").map(
      (m) => m.target,
    );
    const t2 = fpToNumber(TIER_THRESHOLDS[2].minCumulativeRevenue);
    const t3 = fpToNumber(TIER_THRESHOLDS[3].minCumulativeRevenue);
    const t4 = fpToNumber(TIER_THRESHOLDS[4].minCumulativeRevenue);
    expect(revenueRungs.some((target) => target < t2)).toBe(true);
    expect(revenueRungs.some((target) => target > t2 && target < t3)).toBe(true);
    expect(revenueRungs.some((target) => target > t3 && target < t4)).toBe(true);
  });
});

describe("milestone conditions", () => {
  const cases: Array<[string, Partial<MilestoneState>, Partial<MilestoneState>]> = [
    ["first-route", { activeRoutes: 0 }, { activeRoutes: 1 }],
    ["revenue-250k", { cumulativeRevenue: 249_999 }, { cumulativeRevenue: 250_000 }],
    ["three-routes", { activeRoutes: 2 }, { activeRoutes: 3 }],
    ["revenue-1m", { cumulativeRevenue: 999_999 }, { cumulativeRevenue: 1_000_000 }],
    ["fleet-5", { fleetSize: 4 }, { fleetSize: 5 }],
    ["first-owned", { ownedAircraft: 0 }, { ownedAircraft: 1 }],
    ["five-routes", { activeRoutes: 4 }, { activeRoutes: 5 }],
    ["first-jet", { jets: 0 }, { jets: 1 }],
    ["revenue-5m", { cumulativeRevenue: 4_999_999 }, { cumulativeRevenue: 5_000_000 }],
    ["second-hub", { hubs: 1 }, { hubs: 2 }],
    ["brand-70", { brandScore: 0.69 }, { brandScore: 0.7 }],
    ["ten-routes", { activeRoutes: 9 }, { activeRoutes: 10 }],
    ["revenue-25m", { cumulativeRevenue: 24_999_999 }, { cumulativeRevenue: 25_000_000 }],
    ["first-widebody", { widebodies: 0 }, { widebodies: 1 }],
    ["fleet-25", { fleetSize: 24 }, { fleetSize: 25 }],
    ["revenue-100m", { cumulativeRevenue: 99_999_999 }, { cumulativeRevenue: 100_000_000 }],
  ];

  it("covers every milestone", () => {
    expect(cases.map(([id]) => id).sort()).toEqual(MILESTONES.map((m) => m.id).sort());
  });

  for (const [id, below, at] of cases) {
    it(`${id}: unmet just below, met at the target`, () => {
      expect(isMilestoneMet(byId(id), { ...empty, ...below })).toBe(false);
      expect(isMilestoneMet(byId(id), { ...empty, ...at })).toBe(true);
    });
  }
});

describe("milestoneState()", () => {
  const types: Record<string, "turboprop" | "narrowbody" | "widebody"> = {
    atr: "turboprop",
    a320: "narrowbody",
    b787: "widebody",
  };

  it("counts routes, fleet, ownership, jets and widebodies", () => {
    const state = milestoneState(
      { cumulativeRevenue: fp(1_500_000), hubs: ["MAD", "BCN"], brandScore: 0.6 },
      [
        { modelId: "atr", purchaseType: "lease" },
        { modelId: "a320", purchaseType: "buy" },
        { modelId: "b787", purchaseType: "buy" },
        { modelId: "unknown", purchaseType: "lease" },
      ],
      [{ status: "active" }, { status: "active" }, { status: "suspended" }],
      (modelId) => types[modelId],
    );
    expect(state).toEqual({
      activeRoutes: 2,
      cumulativeRevenue: 1_500_000,
      fleetSize: 4,
      ownedAircraft: 2,
      jets: 2,
      widebodies: 1,
      hubs: 2,
      brandScore: 0.6,
    });
  });

  it("tolerates a legacy airline with missing fields", () => {
    const state = milestoneState(
      {
        cumulativeRevenue: undefined as never,
        hubs: undefined as never,
        brandScore: undefined as never,
      },
      [],
      [],
      () => undefined,
    );
    expect(state).toMatchObject({ cumulativeRevenue: 0, hubs: 0, brandScore: 0 });
  });
});

describe("progress and selection", () => {
  it("measures progress in 0–1", () => {
    expect(milestoneProgress(byId("three-routes"), { ...empty, activeRoutes: 2 })).toBeCloseTo(
      2 / 3,
      10,
    );
    expect(milestoneProgress(byId("first-route"), { ...empty, activeRoutes: 4 })).toBe(1);
    expect(milestoneProgress({ ...byId("first-route"), target: 0 }, empty)).toBe(1);
    // A new airline's brand (0.5) is 0% of the way to 0.7, not 71%.
    expect(milestoneProgress(byId("brand-70"), empty)).toBe(0);
    expect(milestoneProgress(byId("brand-70"), { ...empty, brandScore: 0.6 })).toBeCloseTo(0.5, 10);
  });

  it("returns newly met milestones, skipping ones already achieved", () => {
    const state = { ...empty, activeRoutes: 3, cumulativeRevenue: 300_000 };
    expect(newlyMetMilestones(state, new Set()).map((m) => m.id)).toEqual([
      "first-route",
      "revenue-250k",
      "three-routes",
    ]);
    expect(newlyMetMilestones(state, new Set(["first-route"])).map((m) => m.id)).toEqual([
      "revenue-250k",
      "three-routes",
    ]);
  });

  it("suggests the closest unmet milestones", () => {
    const state = { ...empty, activeRoutes: 2, cumulativeRevenue: 900_000, fleetSize: 2 };
    expect(
      nextMilestones(state, new Set(["first-route", "revenue-250k"]), 2).map((m) => m.id),
    ).toEqual(["revenue-1m", "three-routes"]);
  });
});
