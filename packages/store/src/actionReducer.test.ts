import { fp } from "@airtr/core";
import { describe, expect, it } from "vitest";
import { replayActionLog } from "./actionReducer";

describe("replayActionLog", () => {
  it("clamps balance and ignores invalid actions", async () => {
    const pubkey = "pubkey-1";
    const actions = [
      {
        eventId: "evt-1",
        authorPubkey: pubkey,
        createdAt: 1,
        action: {
          schemaVersion: 2,
          action: "AIRLINE_CREATE",
          payload: {
            name: "Test Air",
            icaoCode: "TST",
            callsign: "TEST",
            hubs: ["JFK"],
            corporateBalance: fp(9999999999),
            tick: 1,
          },
        },
      },
      {
        eventId: "evt-2",
        authorPubkey: pubkey,
        createdAt: 2,
        action: {
          schemaVersion: 2,
          action: "AIRCRAFT_PURCHASE",
          payload: {
            instanceId: "ac-1",
            modelId: "invalid-model",
            price: fp(5000000000),
            tick: 2,
          },
        },
      },
    ];

    const result = await replayActionLog({ pubkey, actions });
    expect(result.airline).toBeTruthy();
    expect(result.fleet.length).toBe(0);
    expect(result.airline?.corporateBalance).toBe(fp(1000000000));
    expect(result.actionChainHash).toBeTypeOf("string");
  });

  it("replays a basic route open action", async () => {
    const pubkey = "pubkey-2";
    const actions = [
      {
        eventId: "evt-1",
        authorPubkey: pubkey,
        createdAt: 1,
        action: {
          schemaVersion: 2,
          action: "AIRLINE_CREATE",
          payload: {
            name: "Route Air",
            hubs: ["LAX"],
            corporateBalance: fp(100000000),
            tick: 1,
          },
        },
      },
      {
        eventId: "evt-2",
        authorPubkey: pubkey,
        createdAt: 2,
        action: {
          schemaVersion: 2,
          action: "ROUTE_OPEN",
          payload: {
            routeId: "rt-1",
            originIata: "LAX",
            destinationIata: "SFO",
            distanceKm: 550,
            tick: 2,
          },
        },
      },
    ];

    const result = await replayActionLog({ pubkey, actions });
    expect(result.routes.length).toBe(1);
    expect(result.routes[0]?.originIata).toBe("LAX");
    expect(result.routes[0]?.destinationIata).toBe("SFO");
    expect(result.actionChainHash).toBeTypeOf("string");
  });

  it("updates status via tick update", async () => {
    const pubkey = "pubkey-3";
    const actions = [
      {
        eventId: "evt-1",
        authorPubkey: pubkey,
        createdAt: 1,
        action: {
          schemaVersion: 2,
          action: "AIRLINE_CREATE",
          payload: { name: "Status Air", hubs: ["SEA"], corporateBalance: fp(50000000), tick: 1 },
        },
      },
      {
        eventId: "evt-2",
        authorPubkey: pubkey,
        createdAt: 2,
        action: {
          schemaVersion: 2,
          action: "TICK_UPDATE",
          payload: { status: "chapter11", tick: 5 },
        },
      },
    ];

    const result = await replayActionLog({ pubkey, actions });
    expect(result.airline?.status).toBe("chapter11");
    expect(result.airline?.lastTick).toBe(5);
    expect(result.actionChainHash).toBeTypeOf("string");
  });

  it("cleans up old route assignedAircraftIds on aircraft reassignment", async () => {
    const pubkey = "pubkey-4";
    const actions = [
      {
        eventId: "evt-1",
        authorPubkey: pubkey,
        createdAt: 1,
        action: {
          schemaVersion: 2,
          action: "AIRLINE_CREATE",
          payload: {
            name: "Reassign Air",
            hubs: ["JFK"],
            corporateBalance: fp(500000000),
            tick: 1,
          },
        },
      },
      {
        eventId: "evt-2",
        authorPubkey: pubkey,
        createdAt: 2,
        action: {
          schemaVersion: 2,
          action: "AIRCRAFT_PURCHASE",
          payload: {
            instanceId: "ac-1",
            modelId: "a320neo",
            price: fp(50000000),
            tick: 2,
          },
        },
      },
      {
        eventId: "evt-3",
        authorPubkey: pubkey,
        createdAt: 3,
        action: {
          schemaVersion: 2,
          action: "ROUTE_OPEN",
          payload: {
            routeId: "rt-a",
            originIata: "JFK",
            destinationIata: "LAX",
            distanceKm: 3983,
            tick: 3,
          },
        },
      },
      {
        eventId: "evt-4",
        authorPubkey: pubkey,
        createdAt: 4,
        action: {
          schemaVersion: 2,
          action: "ROUTE_OPEN",
          payload: {
            routeId: "rt-b",
            originIata: "JFK",
            destinationIata: "ORD",
            distanceKm: 1188,
            tick: 4,
          },
        },
      },
      {
        eventId: "evt-5",
        authorPubkey: pubkey,
        createdAt: 5,
        action: {
          schemaVersion: 2,
          action: "ROUTE_ASSIGN_AIRCRAFT",
          payload: {
            aircraftId: "ac-1",
            routeId: "rt-a",
            tick: 100,
          },
        },
      },
      {
        eventId: "evt-6",
        authorPubkey: pubkey,
        createdAt: 6,
        action: {
          schemaVersion: 2,
          action: "ROUTE_ASSIGN_AIRCRAFT",
          payload: {
            aircraftId: "ac-1",
            routeId: "rt-b",
            tick: 200,
          },
        },
      },
    ];

    const result = await replayActionLog({ pubkey, actions });
    const aircraft = result.fleet.find((ac) => ac.id === "ac-1");
    const routeA = result.routes.find((r) => r.id === "rt-a");
    const routeB = result.routes.find((r) => r.id === "rt-b");

    expect(aircraft?.assignedRouteId).toBe("rt-b");
    expect(aircraft?.routeAssignedAtTick).toBe(200);
    expect(routeA?.assignedAircraftIds).not.toContain("ac-1");
    expect(routeB?.assignedAircraftIds).toContain("ac-1");
  });
});
