import { setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { beforeAll, describe, expect, it } from "vitest";
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
    for (const heading of ["Market size", "Fare sweep", "Oversupply", "Aircraft families"]) {
      expect(report).toContain(heading);
    }
    expect(report).toContain("LIH–KOA");
  });
});
