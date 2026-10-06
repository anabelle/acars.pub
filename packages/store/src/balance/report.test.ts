import { setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { beforeAll, describe, expect, it } from "vitest";
import { BRAND_STRATEGIES, brandTrajectory, overAssignmentCurve } from "./brand.js";
import { runLegScenario } from "./legScenario.js";
import { generateBalanceReport } from "./report.js";

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
});
