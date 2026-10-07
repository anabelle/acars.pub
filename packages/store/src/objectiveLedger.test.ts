import { fp, objectiveDayWindow } from "@acars/core";
import { describe, expect, it } from "vitest";
import { type ActionRecord, replayActionLog } from "./actionReducer";

/** S32.2: the replay records daily-objective activity for accepted, state-changing actions. */

const PUBKEY = "objective-player";
const DAY = objectiveDayWindow("2026-10-07");
const NEXT_DAY = objectiveDayWindow("2026-10-08");

let seq = 0;
const record = (
  action: string,
  tick: number,
  payload: Record<string, unknown> = {},
): ActionRecord => {
  seq += 1;
  return {
    eventId: `evt-${seq}`,
    authorPubkey: PUBKEY,
    createdAt: null,
    action: { schemaVersion: 2, action: action as never, payload: { ...payload, tick } },
  };
};

const create = (tick: number, balance = fp(100_000_000)) =>
  record("AIRLINE_CREATE", tick, { name: "Daily Air", hubs: ["MAD"], corporateBalance: balance });
const openRoute = (tick: number, routeId: string, destinationIata: string) =>
  record("ROUTE_OPEN", tick, {
    routeId,
    originIata: "MAD",
    destinationIata,
    distanceKm: 500,
  });
const buy = (tick: number, instanceId: string) =>
  record("AIRCRAFT_PURCHASE", tick, { instanceId, modelId: "a320neo", deliveryHubIata: "MAD" });

describe("objective ledger in replay", () => {
  it("records each accepted action type", async () => {
    const t = DAY.startTick + 100;
    const result = await replayActionLog({
      pubkey: PUBKEY,
      actions: [
        create(t),
        openRoute(t + 1, "r1", "BCN"),
        buy(t + 2, "ac1"),
        record("ROUTE_ASSIGN_AIRCRAFT", t + 3, { aircraftId: "ac1", routeId: "r1" }),
        record("ROUTE_UPDATE_FARES", t + 4, { routeId: "r1", fares: { economy: fp(99) } }),
        record("ROUTE_UPDATE_FREQUENCY", t + 5, { routeId: "r1", frequencyPerWeek: 14 }),
        record("AIRCRAFT_MAINTENANCE", t + 6, { instanceId: "ac1" }),
      ],
    });
    expect(result.objectives.activity).toEqual([
      {
        type: "routeOpened",
        tick: t + 1,
        routeId: "r1",
        originIata: "MAD",
        destinationIata: "BCN",
      },
      { type: "aircraftAcquired", tick: t + 2, aircraftId: "ac1" },
      { type: "aircraftAssigned", tick: t + 3, aircraftId: "ac1", routeId: "r1" },
      { type: "faresUpdated", tick: t + 4, routeId: "r1" },
      { type: "frequencyUpdated", tick: t + 5, routeId: "r1" },
      { type: "aircraftServiced", tick: t + 6, aircraftId: "ac1" },
    ]);
    expect(result.objectives.claimed).toEqual([]);
  });

  it("ignores rejected and no-op actions", async () => {
    const t = DAY.startTick + 100;
    const result = await replayActionLog({
      pubkey: PUBKEY,
      actions: [
        create(t),
        openRoute(t + 1, "r1", "BCN"),
        // Invalid payload (no distance): rejected.
        record("ROUTE_OPEN", t + 2, { routeId: "r2", originIata: "MAD", destinationIata: "LIS" }),
        // Duplicate O/D: aliased, not a new route.
        openRoute(t + 3, "r1-retry", "BCN"),
        // Unknown model, unknown aircraft.
        record("AIRCRAFT_PURCHASE", t + 4, { instanceId: "x", modelId: "nope" }),
        record("AIRCRAFT_MAINTENANCE", t + 5, { instanceId: "x" }),
        // Same frequency and same fares as the route already has.
        record("ROUTE_UPDATE_FREQUENCY", t + 6, { routeId: "r1", frequencyPerWeek: 7 }),
      ],
    });
    expect(result.objectives.activity.map((a) => a.type)).toEqual(["routeOpened"]);

    const fares = result.routes[0];
    const unchanged = await replayActionLog({
      pubkey: PUBKEY,
      actions: [
        create(t),
        openRoute(t + 1, "r1", "BCN"),
        record("ROUTE_UPDATE_FARES", t + 2, {
          routeId: "r1",
          fares: { economy: fares.fareEconomy, business: fares.fareBusiness },
        }),
      ],
    });
    expect(unchanged.objectives.activity.map((a) => a.type)).toEqual(["routeOpened"]);
  });

  it("keeps only the current and previous UTC day", async () => {
    const twoDaysBefore = DAY.startTick - 28_800 - 10;
    const yesterday = DAY.startTick - 10;
    const result = await replayActionLog({
      pubkey: PUBKEY,
      actions: [
        create(twoDaysBefore - 1),
        openRoute(twoDaysBefore, "old", "BCN"),
        openRoute(yesterday, "yday", "LIS"),
        openRoute(DAY.startTick + 1, "today", "ORY"),
      ],
    });
    expect(result.objectives.activity.map((a) => a.type === "routeOpened" && a.routeId)).toEqual([
      "yday",
      "today",
    ]);
  });

  it("carries the ledger through a checkpoint and agrees with a full replay", async () => {
    const t = DAY.startTick + 50;
    const first = [create(t), openRoute(t + 1, "r1", "BCN"), buy(t + 2, "ac1")];
    const second = [
      record("ROUTE_ASSIGN_AIRCRAFT", NEXT_DAY.startTick + 3, { aircraftId: "ac1", routeId: "r1" }),
      openRoute(NEXT_DAY.startTick + 4, "r2", "LIS"),
    ];

    const full = await replayActionLog({ pubkey: PUBKEY, actions: [...first, ...second] });
    const partial = await replayActionLog({ pubkey: PUBKEY, actions: first });
    const resumed = await replayActionLog({
      pubkey: PUBKEY,
      actions: second,
      checkpoint: {
        schemaVersion: 1,
        tick: t + 2,
        createdAt: 0,
        actionChainHash: partial.actionChainHash,
        stateHash: "",
        airline: partial.airline!,
        fleet: partial.fleet,
        routes: partial.routes,
        timeline: partial.timeline,
        objectives: partial.objectives,
      },
    });
    expect(resumed.objectives).toEqual(full.objectives);
    expect(full.objectives.activity).toHaveLength(4);
  });

  it("starts empty for a new airline", async () => {
    const t = DAY.startTick + 10;
    const result = await replayActionLog({
      pubkey: PUBKEY,
      actions: [
        create(t),
        openRoute(t + 1, "r1", "BCN"),
        record("AIRLINE_DISSOLVE", t + 2),
        create(t + 3),
      ],
    });
    expect(result.objectives).toEqual({ activity: [], claimed: [] });
  });
});
