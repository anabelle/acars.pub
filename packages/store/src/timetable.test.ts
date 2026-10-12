import type { FlightOffer, Route } from "@acars/core";
import { fp, TICKS_PER_HOUR, utcDayStartTick } from "@acars/core";
import { describe, expect, it } from "vitest";
import { type ActionRecord, replayActionLog } from "./actionReducer";
import { offersInForce, routesInForce } from "./FlightEngine";
import { lastJoinTickOn } from "./timetable";

const pubkey = "pubkey-timetable";
const day1 = utcDayStartTick(30);
const day2 = utcDayStartTick(31);
const noon2 = day2 + 12 * TICKS_PER_HOUR;
let seq = 0;

function record(action: string, tick: number, payload: Record<string, unknown>): ActionRecord {
  seq += 1;
  return {
    eventId: `evt-${seq}`,
    authorPubkey: pubkey,
    createdAt: seq,
    action: { schemaVersion: 2, action: action as never, payload: { ...payload, tick } },
  };
}

function base(): ActionRecord[] {
  return [
    record("AIRLINE_CREATE", day1 + 10, {
      name: "Timetable Air",
      hubs: ["MAD"],
      corporateBalance: fp(100_000_000),
    }),
    record("ROUTE_OPEN", day1 + 20, {
      routeId: "rt-1",
      originIata: "MAD",
      destinationIata: "BCN",
      distanceKm: 483,
      fares: { economy: fp(100), business: fp(300), first: fp(600) },
    }),
  ];
}

describe("replay: published timetables (S69)", () => {
  it("changes fares at once on the day a route opens", async () => {
    const result = await replayActionLog({
      pubkey,
      actions: [
        ...base(),
        record("ROUTE_UPDATE_FARES", day1 + 30, { routeId: "rt-1", fares: { economy: fp(90) } }),
      ],
    });
    expect(result.routes[0]?.fareEconomy).toBe(fp(90));
    expect(result.routes[0]?.pending).toBeUndefined();
  });

  it("announces fare and frequency changes on a published route for 00:00 UTC tomorrow", async () => {
    const result = await replayActionLog({
      pubkey,
      actions: [
        ...base(),
        record("ROUTE_UPDATE_FARES", noon2, { routeId: "rt-1", fares: { economy: fp(80) } }),
        record("ROUTE_UPDATE_FREQUENCY", noon2 + 5, { routeId: "rt-1", frequencyPerWeek: 3 }),
      ],
    });
    const route = result.routes[0];
    expect(route?.fareEconomy).toBe(fp(100));
    expect(route?.frequencyPerWeek).toBe(7);
    expect(route?.pending).toEqual({
      effectiveTick: utcDayStartTick(32),
      fareEconomy: fp(80),
      frequencyPerWeek: 3,
    });
    const descriptions = result.timeline.map((event) => event.description);
    expect(descriptions.some((d) => d.includes("from 00:00 UTC tomorrow"))).toBe(true);
    expect(descriptions.some((d) => d.includes("Announced new fares"))).toBe(true);
    // The next day it is in force.
    expect(routesInForce(result.routes, utcDayStartTick(32))[0]?.fareEconomy).toBe(fp(80));
  });

  it("flies a frequency rise at once right after a plane joins", async () => {
    const result = await replayActionLog({
      pubkey,
      actions: [
        ...base(),
        record("AIRCRAFT_PURCHASE", day1 + 40, {
          instanceId: "ac-1",
          modelId: "a320neo",
          deliveryHubIata: "MAD",
        }),
        record("ROUTE_ASSIGN_AIRCRAFT", noon2, { aircraftId: "ac-1", routeId: "rt-1" }),
        record("ROUTE_UPDATE_FREQUENCY", noon2 + 1, { routeId: "rt-1", frequencyPerWeek: 21 }),
      ],
    });
    expect(result.fleet[0]?.routeAssignedAtTick).toBe(noon2);
    expect(result.routes[0]?.frequencyPerWeek).toBe(21);
    expect(result.routes[0]?.pending).toBeUndefined();
    expect(
      result.timeline.some((event) => event.description.includes("now flies 21 round trips")),
    ).toBe(true);
  });
});

describe("engine lookups (S69)", () => {
  const route = {
    id: "rt-1",
    fareEconomy: fp(100),
    pending: { effectiveTick: day2, fareEconomy: fp(80) },
  } as Route;

  it("puts routes in force only when something is due", () => {
    const routes = [route];
    expect(routesInForce(routes, day2 - 1)).toBe(routes);
    expect(routesInForce(routes, day2)[0]?.fareEconomy).toBe(fp(80));
  });

  it("serves rivals' offers as in force at the tick", () => {
    const offer = {
      airlinePubkey: "rival",
      fareEconomy: fp(90),
      next: { effectiveTick: day2, fareEconomy: fp(70) },
    } as FlightOffer;
    const plain = [{ ...offer, next: undefined }];
    const registry = new Map([
      ["A-B", [offer]],
      ["C-D", plain],
    ]);
    expect(offersInForce(registry, day2 - 1).get("A-B")?.[0]?.fareEconomy).toBe(fp(90));
    expect(offersInForce(registry, day2).get("A-B")?.[0]?.fareEconomy).toBe(fp(70));
    expect(offersInForce(registry, day2).get("C-D")).toBe(plain);
    expect(offersInForce(registry, day2).get("nope")).toBeUndefined();
  });
});

describe("lastJoinTickOn", () => {
  it("finds the latest join among the route's planes", () => {
    const fleet = new Map([
      ["a", { routeAssignedAtTick: 10 }],
      ["b", { routeAssignedAtTick: 30 }],
      ["c", { routeAssignedAtTick: undefined }],
    ]);
    expect(lastJoinTickOn(["a", "b", "c", "missing"], fleet)).toBe(30);
    expect(lastJoinTickOn(["b", "a"], fleet)).toBe(30);
    expect(lastJoinTickOn(["c"], fleet)).toBeUndefined();
  });
});

describe("rivals' announced fares (S69)", () => {
  it("ride along on their offers", async () => {
    const { buildRouteOffers } = await import("./slices/worldSlice");
    const replay = await replayActionLog({
      pubkey,
      actions: [
        ...base(),
        record("AIRCRAFT_PURCHASE", day1 + 40, {
          instanceId: "ac-1",
          modelId: "a320neo",
          deliveryHubIata: "MAD",
        }),
        record("ROUTE_ASSIGN_AIRCRAFT", day1 + 50, { aircraftId: "ac-1", routeId: "rt-1" }),
        record("ROUTE_UPDATE_FARES", noon2, {
          routeId: "rt-1",
          fares: { economy: fp(70), business: fp(250), first: fp(500) },
        }),
      ],
    });
    const registry = new Map<string, FlightOffer[]>();
    if (!replay.airline) throw new Error("no airline");
    buildRouteOffers(registry, replay.airline, replay.fleet, replay.routes);
    const [offer] = [...registry.values()].flat();
    expect(offer?.fareEconomy).toBe(fp(100));
    expect(offer?.next).toEqual({
      effectiveTick: utcDayStartTick(32),
      fareEconomy: fp(70),
      fareBusiness: fp(250),
      fareFirst: fp(500),
    });

    // A frequency-only announcement doesn't change a rival's offer (theirs comes from planes).
    const freqOnly = replay.routes.map((route) => ({
      ...route,
      pending: { effectiveTick: day2, frequencyPerWeek: 3 },
    }));
    const other = new Map<string, FlightOffer[]>();
    buildRouteOffers(other, replay.airline, replay.fleet, freqOnly);
    expect([...other.values()].flat()[0]?.next).toBeUndefined();
  });
});
