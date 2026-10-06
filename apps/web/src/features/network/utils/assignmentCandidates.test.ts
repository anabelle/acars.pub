import type { AircraftInstance, Route } from "@acars/core";
import { fp } from "@acars/core";
import { describe, expect, it } from "vitest";
import {
  assignmentOption,
  candidateAircraftForRoute,
  candidateRoutesForAircraft,
  type DistanceKm,
} from "./assignmentCandidates";

// ATR 72-600: 1,528 km range.
const makeAircraft = (overrides: Partial<AircraftInstance> = {}): AircraftInstance => ({
  id: "ac-1",
  ownerPubkey: "player",
  modelId: "atr72-600",
  name: "Ship 1",
  status: "idle",
  assignedRouteId: null,
  baseAirportIata: "MAD",
  purchasedAtTick: 0,
  purchasePrice: fp(26_000_000),
  birthTick: 0,
  purchaseType: "lease",
  configuration: { economy: 70, business: 0, first: 0, cargoKg: 0 },
  flightHoursTotal: 0,
  flightHoursSinceCheck: 0,
  condition: 1,
  flight: null,
  ...overrides,
});

const makeRoute = (overrides: Partial<Route> = {}): Route =>
  ({
    id: "r-mad-bcn",
    originIata: "MAD",
    destinationIata: "BCN",
    airlinePubkey: "player",
    distanceKm: 483,
    status: "active",
    assignedAircraftIds: [],
    ...overrides,
  }) as Route;

const KM: Record<string, number> = {
  "BCN-MAD": 483,
  "LIS-MAD": 513,
  "LIS-SVQ": 310,
  "LIS-BCN": 1000,
  "SVQ-MAD": 390,
  "SVQ-BCN": 830,
  "JFK-MAD": 5770,
  "JFK-BCN": 6150,
};
const distance: DistanceKm = (a, b) => KM[`${a}-${b}`] ?? KM[`${b}-${a}`] ?? null;

const HUBS = ["MAD"];

describe("assignmentOption()", () => {
  it("is ready at a hub endpoint", () => {
    expect(assignmentOption(makeAircraft(), makeRoute(), HUBS, distance)).toEqual({
      kind: "ready",
      reassignsFrom: null,
    });
  });

  it("is ready in turnaround or maintenance at the endpoint (only enroute blocks)", () => {
    for (const status of ["turnaround", "maintenance", "delivery"] as const) {
      expect(assignmentOption(makeAircraft({ status }), makeRoute(), HUBS, distance).kind).toBe(
        "ready",
      );
    }
  });

  it("reports reassignment from another route", () => {
    const option = assignmentOption(
      makeAircraft({ assignedRouteId: "r-other" }),
      makeRoute(),
      HUBS,
      distance,
    );
    expect(option).toEqual({ kind: "ready", reassignsFrom: "r-other" });
  });

  it("needs a ferry to the nearest hub endpoint", () => {
    const option = assignmentOption(
      makeAircraft({ baseAirportIata: "LIS" }),
      makeRoute(),
      ["MAD", "BCN"],
      distance,
    );
    expect(option).toEqual({ kind: "ferry", ferryTo: "MAD", ferryKm: 513, reassignsFrom: null });
  });

  it("needs a ferry when the aircraft is at a non-hub endpoint", () => {
    const option = assignmentOption(
      makeAircraft({ baseAirportIata: "BCN" }),
      makeRoute(),
      HUBS,
      distance,
    );
    expect(option).toMatchObject({ kind: "ferry", ferryTo: "MAD" });
  });

  it("explains every blocked case", () => {
    const route = makeRoute();
    const cases: Array<[Partial<AircraftInstance>, Partial<Route>, string[], string]> = [
      [{ assignedRouteId: route.id }, {}, HUBS, "alreadyAssigned"],
      [{ modelId: "nope" }, {}, HUBS, "unknownModel"],
      [{}, { distanceKm: 5_000 }, HUBS, "outOfRange"],
      [{ status: "enroute" }, {}, HUBS, "enroute"],
      [{ baseAirportIata: "LIS" }, {}, ["LIS"], "noHubEndpoint"],
      [{ baseAirportIata: "LIS", status: "turnaround" }, {}, HUBS, "notIdle"],
      [{ baseAirportIata: "JFK" }, {}, HUBS, "ferryOutOfRange"],
      [{ baseAirportIata: "XXX" }, {}, HUBS, "ferryOutOfRange"],
    ];
    for (const [aircraft, routeOverrides, hubs, reason] of cases) {
      expect(
        assignmentOption(makeAircraft(aircraft), makeRoute(routeOverrides), hubs, distance),
      ).toEqual({ kind: "blocked", reason });
    }
  });
});

describe("candidateAircraftForRoute()", () => {
  it("orders ready (free first), then ferries by distance, then blocked; drops current ones", () => {
    const fleet = [
      makeAircraft({ id: "far", name: "Far", baseAirportIata: "LIS" }),
      makeAircraft({ id: "busy", name: "Busy", status: "enroute" }),
      makeAircraft({ id: "moved", name: "Moved", assignedRouteId: "r-x" }),
      makeAircraft({ id: "near", name: "Near", baseAirportIata: "SVQ" }),
      makeAircraft({ id: "free", name: "Free" }),
      makeAircraft({ id: "on", name: "On", assignedRouteId: "r-mad-bcn" }),
      makeAircraft({ id: "zz", name: "Zed", status: "enroute" }),
    ];
    const ids = candidateAircraftForRoute(makeRoute(), fleet, HUBS, distance).map(
      (c) => c.aircraft.id,
    );
    expect(ids).toEqual(["free", "moved", "near", "far", "busy", "zz"]);
  });
});

describe("candidateRoutesForAircraft()", () => {
  it("lists active routes: ready first, then ferries by distance, then blocked", () => {
    const routes = [
      makeRoute({ id: "r-lis", originIata: "LIS", destinationIata: "OPO", distanceKm: 300 }),
      makeRoute({ id: "r-bcn", originIata: "MAD", destinationIata: "BCN" }),
      makeRoute({ id: "r-svq", originIata: "SVQ", destinationIata: "AGP", distanceKm: 200 }),
      makeRoute({ id: "r-agp", originIata: "MAD", destinationIata: "AGP", distanceKm: 430 }),
      makeRoute({ id: "r-off", originIata: "MAD", destinationIata: "VLC", status: "suspended" }),
      makeRoute({ id: "r-long", originIata: "MAD", destinationIata: "JFK", distanceKm: 5770 }),
    ];
    const aircraft = makeAircraft({ baseAirportIata: "LIS" });
    const result = candidateRoutesForAircraft(aircraft, routes, ["MAD", "LIS", "SVQ"], distance);
    expect(result.map((c) => [c.route.id, c.option.kind])).toEqual([
      ["r-lis", "ready"],
      ["r-svq", "ferry"],
      ["r-agp", "ferry"],
      ["r-bcn", "ferry"],
      ["r-long", "blocked"],
    ]);
  });
});
