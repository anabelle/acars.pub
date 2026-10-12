import type { Route } from "@acars/core";
import { fpScale, getSuggestedFares, haversineDistance } from "@acars/core";
import { getAirports, setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { beforeAll, describe, expect, it } from "vitest";
import { computeFlightPassengers } from "./FlightEngine";

beforeAll(() => {
  setAirportsCatalog(airports);
});

function economyAt(destinationIata: string, fareScale: number): number {
  const byIata = new Map(getAirports().map((a) => [a.iata, a]));
  const origin = byIata.get("MAD");
  const destination = byIata.get(destinationIata);
  if (!origin || !destination) throw new Error("airport missing");
  const km = haversineDistance(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );
  const fares = getSuggestedFares(km);
  const route = {
    id: "r1",
    originIata: "MAD",
    destinationIata,
    distanceKm: km,
    airlinePubkey: "me",
    assignedAircraftIds: ["a1"],
    frequencyPerWeek: 2,
    fareEconomy: fpScale(fares.economy, fareScale),
    fareBusiness: fares.business,
    fareFirst: fares.first,
    status: "active",
  } as Route;
  return computeFlightPassengers({
    originIata: "MAD",
    destinationIata,
    tick: 1000,
    seatConfig: { economy: 5000, business: 0, first: 0 },
    model: { speedKmh: 830, turnaroundTimeMinutes: 45, blockHoursPerDay: 14 },
    route,
    competitorOffers: [],
    playerPubkey: "me",
    playerBrandScore: 0.5,
    distanceLimitKm: Number.POSITIVE_INFINITY,
  }).passengersEconomy;
}

describe("passenger groups in the engine (S71)", () => {
  it("a fare rise loses more holiday-makers than business travellers", () => {
    const beachKept = economyAt("TFS", 1.5) / economyAt("TFS", 1);
    const businessKept = economyAt("LHR", 1.5) / economyAt("LHR", 1);
    expect(economyAt("TFS", 1)).toBeGreaterThan(0);
    expect(beachKept).toBeLessThan(businessKept);
    // Economy elasticity −1.37 vs −0.925 (fares also move share against the incumbent).
    expect(beachKept / businessKept).toBeCloseTo(1.5 ** (-1.37 + 0.925), 1);
  });
});
