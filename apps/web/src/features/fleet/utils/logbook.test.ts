import type { TimelineEvent } from "@acars/core";
import { fp } from "@acars/core";
import { describe, expect, it } from "vitest";
import { planeLogbook } from "./logbook";

const AIRPORTS: Record<string, { latitude: number; longitude: number }> = {
  MAD: { latitude: 40.4719, longitude: -3.5626 },
  BCN: { latitude: 41.2971, longitude: 2.0785 },
  LIS: { latitude: 38.7813, longitude: -9.1359 },
};
const landing = (tick: number, from: string, to: string, pax: number, profit: number, id = "a") =>
  ({
    id: `${id}-${tick}`,
    tick,
    timestamp: 0,
    type: "landing",
    description: "",
    aircraftId: id,
    originIata: from,
    destinationIata: to,
    profit: fp(profit),
    details: { passengers: { economy: pax, business: 0, first: 0, total: pax } },
  }) as TimelineEvent;

describe("planeLogbook (S61)", () => {
  it("sums landings, passengers, distance and money for one plane", () => {
    const log = planeLogbook(
      "a",
      [
        landing(300, "MAD", "BCN", 70, 1_000),
        landing(200, "BCN", "MAD", 60, -200),
        landing(100, "MAD", "LIS", 50, 500),
        landing(150, "MAD", "BCN", 99, 9_999, "other"),
      ],
      (iata) => AIRPORTS[iata],
    );
    expect(log.landings).toBe(3);
    expect(log.passengers).toBe(180);
    expect(log.profit).toBe(fp(1_300));
    expect(log.sinceTick).toBe(100);
    expect(log.airports).toEqual(["MAD", "BCN", "LIS"]);
    // ~483 km twice plus ~513 km.
    expect(log.distanceKm).toBeGreaterThan(1_400);
    expect(log.distanceKm).toBeLessThan(1_550);
  });

  it("is empty for a plane that has not flown", () => {
    expect(planeLogbook("a", [], () => undefined)).toEqual({
      landings: 0,
      passengers: 0,
      distanceKm: 0,
      profit: fp(0),
      airports: [],
      sinceTick: null,
    });
  });
});
