import { setActiveEventsOverride, WORLD_EVENT_TEMPLATES, type WorldEvent } from "@acars/core";
import { setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { BRAND_STRATEGIES, brandTrajectory, overAssignmentCurve } from "./brand.js";
import { runLegScenario } from "./legScenario.js";
import { generateBalanceReport } from "./report.js";
import { STRATEGIES, simulateStrategy } from "./strategy.js";

beforeAll(() => {
  setAirportsCatalog(airports);
});

describe("balance harness", () => {
  it("runs a leg through the real engine", () => {
    const leg = runLegScenario({
      originIata: "MAD",
      destinationIata: "BCN",
      modelId: "atr72-600",
      fareMultiplier: 1,
      aircraftCount: 1,
    });
    expect(leg.distanceKm).toBeGreaterThan(450);
    expect(leg.loadFactor).toBeGreaterThan(0);
    expect(leg.legsPerDayPerAircraft).toBeGreaterThan(1);
  });

  it("generates every section of the report", () => {
    const report = generateBalanceReport();
    for (const heading of [
      "Market size",
      "Fare sweep",
      "Oversupply",
      "Aircraft families",
      "Day-one strategies",
      "Over-assignment curve",
      "Brand trajectories",
      "World events",
    ]) {
      expect(report).toContain(heading);
    }
    expect(report).toContain("LIH–KOA");
    expect(report).toContain("Greedy");
  });

  it("over-assignment curve is monotone and smooth (S11)", () => {
    const curve = overAssignmentCurve();
    expect(curve).toHaveLength(20);
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i].loadFactor).toBeLessThanOrEqual(curve[i - 1].loadFactor);
      expect(curve[i - 1].loadFactor - curve[i].loadFactor).toBeLessThan(0.15);
    }
    // Twice the seats demand needs fills about half of them, not ~20%.
    expect(curve[9].loadFactor).toBeGreaterThan(0.3);
  });

  it("greedy strategies lose brand over 30 days, balanced gains (S11)", () => {
    const [balanced, ...greedy] = BRAND_STRATEGIES.map((strategy) => brandTrajectory(strategy));
    expect(balanced.brandByDay[30]).toBeGreaterThan(0.6);
    for (const trajectory of greedy) {
      expect(trajectory.brandByDay[30]).toBeLessThan(0.45);
    }
  });

  it("tier pacing hits the S12 targets", () => {
    const [cautious, balanced, greedy] = STRATEGIES.map((strategy) =>
      simulateStrategy(strategy, { days: 60 }),
    );
    const t2 = balanced.daysToTier[2];
    const t3 = balanced.daysToTier[3];
    expect(t2).not.toBeNull();
    expect(t2).toBeGreaterThanOrEqual(1);
    expect(t2).toBeLessThanOrEqual(3);
    expect(t3).toBeGreaterThanOrEqual(21);
    expect(t3).toBeLessThanOrEqual(28);
    // Greedy is never more than 2× faster than balanced.
    expect((greedy.daysToTier[2] ?? 0) * 2).toBeGreaterThanOrEqual(t2 ?? 0);
    expect((greedy.daysToTier[3] ?? 0) * 2).toBeGreaterThanOrEqual(t3 ?? 0);
    // Cautious still gets there, just later.
    expect(cautious.daysToTier[2]).toBeGreaterThan(t2 ?? 0);
  });
});

describe("world events in the engine (S33)", () => {
  afterEach(() => setActiveEventsOverride(null));

  const pinned = (kind: WorldEvent["kind"], airportIata: string | null) => {
    const template = WORLD_EVENT_TEMPLATES.find((t) => t.kind === kind)!;
    setActiveEventsOverride([
      {
        id: kind,
        kind,
        airportIata,
        startTick: 0,
        endTick: Number.MAX_SAFE_INTEGER,
        demandMultiplier: template.demandMultiplier,
        feesMultiplier: template.feesMultiplier,
        fuelMultiplier: template.fuelMultiplier,
      },
    ]);
  };
  const leg = () =>
    runLegScenario({
      originIata: "DEN",
      destinationIata: "SLC",
      modelId: "atr72-600",
      fareMultiplier: 1,
      aircraftCount: 1,
    });
  const calm = () => {
    setActiveEventsOverride([]);
    return leg();
  };

  it("a festival at either end fills more seats", () => {
    const base = calm();
    pinned("festival", "SLC");
    expect(leg().passengers).toBeGreaterThan(base.passengers);
    pinned("festival", "DEN");
    expect(leg().passengers).toBeGreaterThan(base.passengers);
  });

  it("strikes, congestion and fuel spikes cost money; unrelated airports don't", () => {
    const base = calm();
    for (const [kind, airport] of [
      ["strike", "SLC"],
      ["hubCongestion", "DEN"],
      ["fuelSpike", null],
    ] as const) {
      pinned(kind, airport);
      expect(leg().profitPerLeg).toBeLessThan(base.profitPerLeg);
    }
    pinned("hubCongestion", "JFK");
    expect(leg().profitPerLeg).toBe(base.profitPerLeg);
  });
});
