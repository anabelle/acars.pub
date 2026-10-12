import type { AirlineEntity, Route } from "@acars/core";
import { fp } from "@acars/core";
import { getAirports, setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { beforeAll, describe, expect, it } from "vitest";
import { type ActionRecord, replayActionLog } from "./actionReducer";
import { computeConnectionService, legKey } from "./connections";
import { alliedRoutes } from "./slices/engineSlice";

const ME = "a".repeat(64);
const ALLY = "b".repeat(64);
const OTHER = "c".repeat(64);

beforeAll(() => {
  setAirportsCatalog(airports);
});

const route = (id: string, o: string, d: string, owner = ME): Route =>
  ({
    id,
    originIata: o,
    destinationIata: d,
    distanceKm: 600,
    airlinePubkey: owner,
    assignedAircraftIds: [],
    fareEconomy: fp(150),
    fareBusiness: fp(450),
    fareFirst: fp(800),
    status: "active",
    frequencyPerWeek: 14,
  }) as Route;

describe("replay: ALLIANCE_SET (S73)", () => {
  it("records the named partners, never oneself, and clears them", async () => {
    let seq = 0;
    const record = (action: string, payload: Record<string, unknown>): ActionRecord => {
      seq += 1;
      return {
        eventId: `e${seq}`,
        authorPubkey: ME,
        createdAt: seq,
        action: { schemaVersion: 2, action: action as never, payload: { ...payload, tick: seq } },
      };
    };
    const create = record("AIRLINE_CREATE", {
      name: "Me Air",
      hubs: ["MAD"],
      corporateBalance: fp(1_000_000),
    });
    const allied = await replayActionLog({
      pubkey: ME,
      actions: [create, record("ALLIANCE_SET", { partners: [ALLY, ME, "junk"] })],
    });
    expect(allied.airline?.alliancePartners).toEqual([ALLY]);
    const garbage = await replayActionLog({
      pubkey: ME,
      actions: [create, record("ALLIANCE_SET", { partners: "nope" })],
    });
    expect(garbage.airline?.alliancePartners).toBeUndefined();
    const cleared = await replayActionLog({
      pubkey: ME,
      actions: [
        create,
        record("ALLIANCE_SET", { partners: [ALLY] }),
        record("ALLIANCE_SET", { partners: [] }),
      ],
    });
    expect(cleared.airline?.alliancePartners).toEqual([]);
    expect(cleared.timeline.some((e) => e.description === "No alliance partners.")).toBe(true);
  });
});

describe("codeshare connections (S73)", () => {
  const airport = (iata: string) => getAirports().find((a) => a.iata === iata);
  const tick = 500 * 28_800;

  it("carries passengers connecting to an ally's flight on our leg", () => {
    const mine = [route("r1", "MAD", "LIS")];
    const alone = computeConnectionService(mine, [], tick, airport);
    expect(alone.byLeg.size).toBe(0);
    const withAlly = computeConnectionService(mine, [], tick, airport, [
      route("a1", "MAD", "CDG", ALLY),
    ]);
    expect(withAlly.byLeg.get(legKey("LIS", "MAD"))?.economy ?? 0).toBeGreaterThan(0);
    expect(withAlly.byLeg.get(legKey("MAD", "LIS"))?.economy ?? 0).toBeGreaterThan(0);
    // Only our legs are credited.
    expect(withAlly.byLeg.has(legKey("MAD", "CDG"))).toBe(false);
    expect(withAlly.hubs.get("MAD")?.codeshareWeekly ?? 0).toBeGreaterThan(0);
  });

  it("adds codeshare passengers next to our own hub's, and skips markets flown direct", () => {
    const mine = [route("r1", "MAD", "LIS"), route("r2", "MAD", "SVQ")];
    const own = computeConnectionService(mine, [], tick, airport);
    const allied = computeConnectionService(mine, [], tick, airport, [
      route("a1", "MAD", "CDG", ALLY),
      route("a2", "LIS", "CDG", ALLY),
    ]);
    const hub = allied.hubs.get("MAD");
    expect(hub?.weekly ?? 0).toBe(own.hubs.get("MAD")?.weekly ?? 0);
    expect(hub?.codeshareWeekly ?? 0).toBeGreaterThan(0);
    // LIS–CDG is flown direct by the ally: no connection sold for it via MAD.
    const onlyLis = computeConnectionService([route("r1", "MAD", "LIS")], [], tick, airport, [
      route("a1", "MAD", "CDG", ALLY),
      route("a2", "LIS", "CDG", ALLY),
    ]);
    expect(onlyLis.hubs.get("MAD")?.codeshareWeekly ?? 0).toBe(0);
    // An ally that only serves our own ends adds nothing.
    const sameEnds = computeConnectionService(mine, [], tick, airport, [
      route("a3", "MAD", "LIS", ALLY),
    ]);
    expect(sameEnds.hubs.get("MAD")?.codeshareWeekly ?? 0).toBe(0);
    // Ally routes at airports we don't serve, or with no airport data, add nothing.
    expect(
      computeConnectionService([route("r1", "MAD", "LIS")], [], tick, airport, [
        route("a4", "FRA", "CDG", ALLY),
      ]).byLeg.size,
    ).toBe(0);
    expect(
      computeConnectionService([route("r1", "ZZZ", "LIS")], [], tick, airport, [
        route("a5", "ZZZ", "CDG", ALLY),
      ]).byLeg.size,
    ).toBe(0);
    expect(
      computeConnectionService([], [], tick, airport, [route("a6", "MAD", "CDG", ALLY)]).byLeg.size,
    ).toBe(0);
  });
});

describe("alliedRoutes (S73)", () => {
  it("returns only the routes of partners who name us back", () => {
    const competitors = new Map<string, AirlineEntity>([
      [ALLY, { alliancePartners: [ME] } as AirlineEntity],
      [OTHER, { alliancePartners: [] } as AirlineEntity],
    ]);
    const routesByOwner = new Map([
      [ALLY, [route("a1", "MAD", "CDG", ALLY)]],
      [OTHER, [route("o1", "MAD", "FRA", OTHER)]],
    ]);
    const state = {
      pubkey: ME,
      airline: { alliancePartners: [ALLY, OTHER] } as AirlineEntity,
      competitors,
      routesByOwner,
    };
    expect(alliedRoutes(state).map((r) => r.id)).toEqual(["a1"]);
    expect(alliedRoutes({ ...state, pubkey: null })).toEqual([]);
    expect(alliedRoutes({ ...state, airline: null })).toEqual([]);
    expect(alliedRoutes({ ...state, routesByOwner: new Map() })).toEqual([]);
  });
});
