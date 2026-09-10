import { describe, expect, it } from "vitest";
import { fp } from "./fixed-point.js";
import { buildHubState, getAirportTraffic } from "./hub.js";
import type { Route } from "./types.js";

describe("buildHubState", () => {
  it("counts spokes and frequency from routes departing or landing at the hub", () => {
    const routes: Route[] = [
      {
        id: "r1",
        originIata: "JFK",
        destinationIata: "LAX",
        airlinePubkey: "pub",
        distanceKm: 4000,
        assignedAircraftIds: [],
        fareEconomy: fp(0),
        fareBusiness: fp(0),
        fareFirst: fp(0),
        status: "active",
        frequencyPerWeek: 14,
      },
      {
        id: "r2",
        originIata: "JFK",
        destinationIata: "SFO",
        airlinePubkey: "pub",
        distanceKm: 4200,
        assignedAircraftIds: [],
        fareEconomy: fp(0),
        fareBusiness: fp(0),
        fareFirst: fp(0),
        status: "active",
      },
      {
        id: "r3",
        originIata: "LAX",
        destinationIata: "JFK",
        airlinePubkey: "pub",
        distanceKm: 4000,
        assignedAircraftIds: [],
        fareEconomy: fp(0),
        fareBusiness: fp(0),
        fareFirst: fp(0),
        status: "active",
        frequencyPerWeek: 7,
      },
    ];

    const result = buildHubState("JFK", routes);
    expect(result.hubIata).toBe("JFK");
    // r1/r2 depart from JFK; r3 lands at JFK — all three are spokes.
    expect(result.spokeCount).toBe(3);
    expect(result.weeklyFrequency).toBe(21);
    expect(result.avgFrequency).toBe(7);
  });

  it("returns zeros when no routes touch the hub", () => {
    const routes: Route[] = [
      {
        id: "r1",
        originIata: "LAX",
        destinationIata: "SFO",
        airlinePubkey: "pub",
        distanceKm: 4000,
        assignedAircraftIds: [],
        fareEconomy: fp(0),
        fareBusiness: fp(0),
        fareFirst: fp(0),
        status: "active",
        frequencyPerWeek: 7,
      },
    ];

    const result = buildHubState("JFK", routes);
    expect(result.spokeCount).toBe(0);
    expect(result.weeklyFrequency).toBe(0);
    expect(result.avgFrequency).toBe(0);
  });

  it("counts a route that only lands at the hub", () => {
    const routes: Route[] = [
      {
        id: "r1",
        originIata: "LAX",
        destinationIata: "JFK",
        airlinePubkey: "pub",
        distanceKm: 4000,
        assignedAircraftIds: [],
        fareEconomy: fp(0),
        fareBusiness: fp(0),
        fareFirst: fp(0),
        status: "active",
        frequencyPerWeek: 7,
      },
    ];

    const result = buildHubState("JFK", routes);
    expect(result.spokeCount).toBe(1);
    expect(result.weeklyFrequency).toBe(7);
    expect(result.avgFrequency).toBe(7);
  });
});

describe("getAirportTraffic", () => {
  it("returns zero when there are no matching routes", () => {
    const routes: Route[] = [
      {
        id: "r1",
        originIata: "LAX",
        destinationIata: "SFO",
        airlinePubkey: "pub",
        distanceKm: 500,
        assignedAircraftIds: [],
        fareEconomy: fp(0),
        fareBusiness: fp(0),
        fareFirst: fp(0),
        status: "active",
        frequencyPerWeek: 14,
      },
    ];

    expect(getAirportTraffic("JFK", routes)).toBe(0);
  });

  it("counts origin and destination frequencies", () => {
    const routes: Route[] = [
      {
        id: "r1",
        originIata: "JFK",
        destinationIata: "LAX",
        airlinePubkey: "pub",
        distanceKm: 4000,
        assignedAircraftIds: [],
        fareEconomy: fp(0),
        fareBusiness: fp(0),
        fareFirst: fp(0),
        status: "active",
        frequencyPerWeek: 14,
      },
      {
        id: "r2",
        originIata: "SFO",
        destinationIata: "JFK",
        airlinePubkey: "pub",
        distanceKm: 4200,
        assignedAircraftIds: [],
        fareEconomy: fp(0),
        fareBusiness: fp(0),
        fareFirst: fp(0),
        status: "active",
        frequencyPerWeek: 7,
      },
      {
        id: "r3",
        originIata: "SEA",
        destinationIata: "LAX",
        airlinePubkey: "pub",
        distanceKm: 1500,
        assignedAircraftIds: [],
        fareEconomy: fp(0),
        fareBusiness: fp(0),
        fareFirst: fp(0),
        status: "active",
      },
    ];

    const hourly = getAirportTraffic("JFK", routes);
    expect(hourly).toBeCloseTo(21 / (7 * 24), 8);
  });
});
