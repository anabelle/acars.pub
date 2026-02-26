import { fp } from "@airtr/core";
import { describe, expect, it } from "vitest";
import { replayActionLog } from "./actionReducer";

describe("replayActionLog", () => {
  it("clamps balance and ignores invalid actions", () => {
    const pubkey = "pubkey-1";
    const actions = [
      {
        eventId: "evt-1",
        authorPubkey: pubkey,
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

    const result = replayActionLog({ pubkey, actions });
    expect(result.airline).toBeTruthy();
    expect(result.fleet.length).toBe(0);
    expect(result.airline?.corporateBalance).toBe(fp(1000000000));
  });

  it("replays a basic route open action", () => {
    const pubkey = "pubkey-2";
    const actions = [
      {
        eventId: "evt-1",
        authorPubkey: pubkey,
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

    const result = replayActionLog({ pubkey, actions });
    expect(result.routes.length).toBe(1);
    expect(result.routes[0]?.originIata).toBe("LAX");
    expect(result.routes[0]?.destinationIata).toBe("SFO");
  });

  it("updates status via tick update", () => {
    const pubkey = "pubkey-3";
    const actions = [
      {
        eventId: "evt-1",
        authorPubkey: pubkey,
        action: {
          schemaVersion: 2,
          action: "AIRLINE_CREATE",
          payload: { name: "Status Air", hubs: ["SEA"], corporateBalance: fp(50000000), tick: 1 },
        },
      },
      {
        eventId: "evt-2",
        authorPubkey: pubkey,
        action: {
          schemaVersion: 2,
          action: "TICK_UPDATE",
          payload: { status: "chapter11", tick: 5 },
        },
      },
    ];

    const result = replayActionLog({ pubkey, actions });
    expect(result.airline?.status).toBe("chapter11");
    expect(result.airline?.lastTick).toBe(5);
  });
});
