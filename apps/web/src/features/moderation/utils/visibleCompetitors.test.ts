import type { AircraftInstance, AirlineEntity, Route } from "@acars/core";
import { fp } from "@acars/core";
import { describe, expect, it } from "vitest";
import {
  buildVisibleCompetitorFleet,
  buildVisibleCompetitorRoutes,
  filterVisibleCompetitors,
} from "./visibleCompetitors";

const makeAirline = (overrides: Partial<AirlineEntity> = {}): AirlineEntity => ({
  id: "airline-1",
  foundedBy: "founder",
  status: "private",
  ceoPubkey: "pubkey-1",
  sharesOutstanding: 10000000,
  shareholders: { "pubkey-1": 10000000 },
  name: "Test Air",
  icaoCode: "TST",
  callsign: "TEST",
  hubs: ["JFK"],
  livery: { primary: "#111111", secondary: "#222222", accent: "#333333" },
  brandScore: 0.7,
  tier: 1,
  cumulativeRevenue: fp(0),
  corporateBalance: fp(1000000),
  stockPrice: fp(0),
  fleetIds: [],
  routeIds: [],
  ...overrides,
});

const makeAircraft = (id: string, ownerPubkey: string): AircraftInstance => ({
  id,
  ownerPubkey,
  modelId: "a320neo",
  name: "Ship 1",
  status: "idle",
  assignedRouteId: null,
  baseAirportIata: "JFK",
  purchasedAtTick: 0,
  purchasePrice: fp(100000000),
  birthTick: 0,
  purchaseType: "buy",
  configuration: { economy: 156, business: 24, first: 0, cargoKg: 3700 },
  flightHoursTotal: 0,
  flightHoursSinceCheck: 0,
  condition: 1,
  flight: null,
});

const makeRoute = (id: string, airlinePubkey: string): Route => ({
  id,
  airlinePubkey,
  originIata: "JFK",
  destinationIata: "LAX",
  distanceKm: 3983,
  frequencyPerWeek: 7,
  assignedAircraftIds: [],
  fareEconomy: fp(10000),
  fareBusiness: fp(20000),
  fareFirst: fp(30000),
  status: "active",
});

describe("visible competitor filters", () => {
  it("filters competitors, fleets, and routes by muted CEO pubkey", () => {
    const competitors = new Map<string, AirlineEntity>([
      ["comp-1", makeAirline({ id: "a1", ceoPubkey: "comp-1", name: "Alpha" })],
      ["comp-2", makeAirline({ id: "a2", ceoPubkey: "comp-2", name: "Beta" })],
    ]);
    const fleetByOwner = new Map<string, AircraftInstance[]>([
      ["player", [makeAircraft("p1", "player")]],
      ["comp-1", [makeAircraft("c1", "comp-1")]],
      ["comp-2", [makeAircraft("c2", "comp-2")]],
    ]);
    const routesByOwner = new Map<string, Route[]>([
      ["player", [makeRoute("r-player", "player")]],
      ["comp-1", [makeRoute("r-1", "comp-1")]],
      ["comp-2", [makeRoute("r-2", "comp-2")]],
    ]);

    const muted = new Set(["comp-2"]);

    expect(Array.from(filterVisibleCompetitors(competitors, muted).keys())).toEqual(["comp-1"]);
    expect(
      buildVisibleCompetitorFleet(fleetByOwner, "player", muted).map((aircraft) => aircraft.id),
    ).toEqual(["c1"]);
    expect(
      buildVisibleCompetitorRoutes(routesByOwner, "player", muted).map((route) => route.id),
    ).toEqual(["r-1"]);
  });
});
