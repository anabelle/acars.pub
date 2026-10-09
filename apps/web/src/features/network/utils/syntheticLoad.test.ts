import type { Airport } from "@acars/core";
import { haversineDistance } from "@acars/core";
import { describe, expect, it } from "vitest";
import { parseMapLoad, syntheticFleet } from "./syntheticLoad";

const airport = (iata: string, latitude: number, longitude: number, population: number) =>
  ({ iata, latitude, longitude, population }) as Airport;

const airports = [
  airport("MAD", 40.47, -3.56, 6_000_000),
  airport("JFK", 40.64, -73.78, 8_000_000),
  airport("LHR", 51.47, -0.45, 9_000_000),
  airport("NRT", 35.77, 140.39, 13_000_000),
  airport("XXX", 40.5, -3.6, 1),
];

describe("parseMapLoad()", () => {
  it("accepts only the benchmark loads", () => {
    expect(parseMapLoad("?load=10000")).toBe(10000);
    expect(parseMapLoad("?load=50000&panel=map")).toBe(50000);
    expect(parseMapLoad("?load=123")).toBe(0);
    expect(parseMapLoad("")).toBe(0);
  });
});

describe("syntheticFleet()", () => {
  it("puts that many aircraft in the air, on 300–9,000 km legs, deterministically", () => {
    const fleet = syntheticFleet(200, airports, 1_000_000);
    expect(fleet).toHaveLength(200);
    expect(syntheticFleet(200, airports, 1_000_000)).toEqual(fleet);
    const byIata = new Map(airports.map((a) => [a.iata, a]));
    for (const aircraft of fleet) {
      expect(aircraft.status).toBe("enroute");
      expect(aircraft.ownerPubkey).toBe("synthetic");
      const flight = aircraft.flight;
      if (!flight) throw new Error("no flight");
      const a = byIata.get(flight.originIata);
      const b = byIata.get(flight.destinationIata);
      if (!a || !b) throw new Error("unknown airport");
      const km = haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
      expect(km).toBeGreaterThanOrEqual(300);
      expect(km).toBeLessThanOrEqual(9_000);
      // In the air now.
      expect(flight.departureTick).toBeLessThanOrEqual(1_000_000);
      expect(flight.arrivalTick).toBeGreaterThan(1_000_000);
    }
  });

  it("is empty without a load or enough airports", () => {
    expect(syntheticFleet(0, airports, 0)).toEqual([]);
    expect(syntheticFleet(10, airports.slice(0, 1), 0)).toEqual([]);
  });
});
