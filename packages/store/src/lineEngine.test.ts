import type { AircraftInstance, Route } from "@acars/core";
import { fp, lineLandingCount, linePhaseAt, TICKS_PER_DAY, TICKS_PER_HOUR } from "@acars/core";
import { getAircraftById, setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { beforeAll, describe, expect, it } from "vitest";
import { replayActionLog } from "./actionReducer";
import { processFlightEngine, reconcileFleetToTick } from "./FlightEngine";
import {
  advanceLineAircraft,
  applyAircraftLine,
  buildLineLegs,
  describeLine,
  type LineLegRequest,
} from "./lineEngine";

const H = TICKS_PER_HOUR;
const model = getAircraftById("a320neo")!;
const route = (id: string, o: string, d: string, km: number): Route =>
  ({
    id,
    originIata: o,
    destinationIata: d,
    distanceKm: km,
    airlinePubkey: "me",
    frequencyPerWeek: 7,
    assignedAircraftIds: [],
    fareEconomy: fp(150),
    fareBusiness: fp(450),
    fareFirst: fp(800),
    status: "active",
  }) as Route;
const routes = [
  route("r1", "MAD", "BCN", 483),
  route("r2", "BCN", "LIS", 1000),
  route("r3", "MAD", "LIS", 513),
];
const routeById = new Map(routes.map((r) => [r.id, r]));
const requests: LineLegRequest[] = [
  { routeId: "r1", direction: "outbound", departOffsetTicks: 7 * H },
  { routeId: "r2", direction: "outbound", departOffsetTicks: 9.5 * H },
  { routeId: "r3", direction: "inbound", departOffsetTicks: 13 * H },
];
const start = 400 * TICKS_PER_DAY + 2 * H;

const plane = (): AircraftInstance =>
  ({
    id: "ac-1",
    ownerPubkey: "me",
    modelId: "a320neo",
    name: "Quetzal",
    status: "idle",
    assignedRouteId: null,
    baseAirportIata: "MAD",
    purchasedAtTick: 0,
    purchasePrice: fp(1),
    birthTick: 0,
    flight: null,
    purchaseType: "buy",
    configuration: { economy: 180, business: 0, first: 0, cargoKg: 0 },
    flightHoursTotal: 0,
    flightHoursSinceCheck: 0,
    condition: 1,
  }) as AircraftInstance;

const lined = (): AircraftInstance => {
  const built = buildLineLegs(requests, routeById, model);
  if (!built.legs) throw new Error(built.error);
  return { ...plane(), line: { legs: built.legs, startTick: start } };
};

beforeAll(() => setAirportsCatalog(airports));

describe("buildLineLegs", () => {
  it("turns route directions into a closed chain with this plane's timings", () => {
    const built = buildLineLegs(requests, routeById, model);
    expect(built.error).toBeNull();
    expect(describeLine(built.legs ?? [])).toBe("MAD→BCN→LIS→MAD");
    expect(built.legs?.[2]).toMatchObject({ originIata: "LIS", destinationIata: "MAD" });
  });

  it("refuses unknown, closed and out-of-range routes and broken chains", () => {
    expect(buildLineLegs([{ ...requests[0], routeId: "nope" }], routeById, model).error).toBe(
      "unknown-route",
    );
    const far = new Map([...routeById, ["r9", route("r9", "MAD", "SYD", 17_600)]]);
    expect(
      buildLineLegs([{ routeId: "r9", direction: "outbound", departOffsetTicks: 0 }], far, model)
        .error,
    ).toBe("out-of-range");
    expect(buildLineLegs(requests.slice(0, 2), routeById, model).error).toBe("not-closed");
  });
});

describe("advanceLineAircraft (catch-up)", () => {
  it("pays every landing of a three-day absence and ends where the line says", () => {
    const ac = lined();
    const to = start + 3 * TICKS_PER_DAY + 10 * H;
    const advance = advanceLineAircraft(
      ac,
      model,
      start,
      to,
      "estimate",
      {
        routeById,
        airportTraffic: new Map(),
        hubStates: new Map(),
        registry: new Map(),
        lineService: new Map(),
        playerPubkey: "me",
        playerBrandScore: 0.5,
        distanceLimitKm: Number.POSITIVE_INFINITY,
      },
      0.00005,
    );
    const total = lineLandingCount(ac.line!, ac.id, start, to).reduce((a, b) => a + b, 0);
    const landings = advance.events.filter((e) => e.type === "landing");
    expect(landings).toHaveLength(total);
    expect(landings.every((e) => typeof e.details?.delayTicks === "number")).toBe(true);
    expect(advance.balanceDelta).not.toBe(fp(0));
    const phase = linePhaseAt(ac.line!, ac.id, to);
    expect(ac.status).toBe(phase.status);
    expect(ac.flightHoursTotal).toBeGreaterThan(0);
  });
});

describe("live engine and catch-up agree", () => {
  it("a day ticked live lands the same flights and ends in the same place", () => {
    let fleet = [lined()];
    const fromTick = start;
    fleet[0].lastTickProcessed = fromTick;
    let landings = 0;
    for (let tick = fromTick + 1; tick <= fromTick + TICKS_PER_DAY; tick++) {
      const result = processFlightEngine(tick, fleet, routes, fp(1_000_000), tick - 1);
      fleet = result.updatedFleet;
      landings += result.events.filter((e) => e.type === "landing").length;
    }
    const caughtUp = reconcileFleetToTick(
      [{ ...lined(), lastTickProcessed: fromTick }],
      routes,
      fromTick + TICKS_PER_DAY,
    );
    expect(landings).toBeGreaterThanOrEqual(3);
    expect(landings).toBe(caughtUp.events.filter((e) => e.type === "landing").length);
    expect(fleet[0].status).toBe(caughtUp.fleet[0].status);
    expect(fleet[0].baseAirportIata).toBe(caughtUp.fleet[0].baseAirportIata);
    expect(fleet[0].flight?.departureTick).toBe(caughtUp.fleet[0].flight?.departureTick);
  });
});

describe("applyAircraftLine (optimistic)", () => {
  it("lists the plane on each leg's route and clears its single route", () => {
    const fleet = [{ ...plane(), assignedRouteId: "r1" }];
    const withPlane = routes.map((r) =>
      r.id === "r1" ? { ...r, assignedAircraftIds: ["ac-1"] } : r,
    );
    const result = applyAircraftLine(fleet, withPlane, "ac-1", requests, start, model);
    if ("error" in result) throw new Error(result.error);
    expect(result.fleet[0].assignedRouteId).toBeNull();
    expect(result.fleet[0].line?.legs).toHaveLength(3);
    expect(result.routes.every((r) => r.assignedAircraftIds.includes("ac-1"))).toBe(true);
    const cleared = applyAircraftLine(result.fleet, result.routes, "ac-1", [], start + 1, model);
    if ("error" in cleared) throw new Error(cleared.error);
    expect(cleared.fleet[0].line).toBeNull();
    expect(cleared.routes.some((r) => r.assignedAircraftIds.includes("ac-1"))).toBe(false);
  });

  it("will not set a line in the air or away from its first airport", () => {
    const flying = {
      ...plane(),
      status: "enroute" as const,
      flight: {
        originIata: "MAD",
        destinationIata: "BCN",
        departureTick: start - H,
        arrivalTick: start + H,
        direction: "outbound" as const,
      },
    };
    expect(applyAircraftLine([flying], routes, "ac-1", requests, start, model)).toEqual({
      error: "flying",
    });
    const away = { ...plane(), baseAirportIata: "BCN" };
    expect(applyAircraftLine([away], routes, "ac-1", requests, start, model)).toEqual({
      error: "not-at-start",
    });
  });
});

describe("AIRCRAFT_LINE_SET (replay)", () => {
  const pubkey = "pubkey-lines";
  const act = (
    eventId: string,
    createdAt: number,
    action: string,
    payload: Record<string, unknown>,
  ) => ({
    eventId,
    authorPubkey: pubkey,
    createdAt,
    action: { schemaVersion: 2 as const, action: action as never, payload },
  });
  const base = [
    act("e1", 1, "AIRLINE_CREATE", {
      name: "Line Air",
      hubs: ["MAD"],
      corporateBalance: fp(500_000_000),
      tick: 1,
    }),
    act("e2", 2, "ROUTE_OPEN", {
      routeId: "r1",
      originIata: "MAD",
      destinationIata: "BCN",
      distanceKm: 483,
      tick: 2,
    }),
    act("e3", 3, "ROUTE_OPEN", {
      routeId: "r2",
      originIata: "BCN",
      destinationIata: "LIS",
      distanceKm: 1000,
      tick: 3,
    }),
    act("e4", 4, "ROUTE_OPEN", {
      routeId: "r3",
      originIata: "MAD",
      destinationIata: "LIS",
      distanceKm: 513,
      tick: 4,
    }),
    act("e5", 5, "AIRCRAFT_PURCHASE", {
      instanceId: "ac-1",
      modelId: "a320neo",
      deliveryHubIata: "MAD",
      tick: 5,
    }),
  ];

  it("sets a line from the plane's airport and lists it on every leg's route", async () => {
    const result = await replayActionLog({
      pubkey,
      actions: [
        ...base,
        act("e6", 6, "AIRCRAFT_LINE_SET", { aircraftId: "ac-1", legs: requests, tick: 6 }),
      ],
    });
    const ac = result.fleet.find((a) => a.id === "ac-1");
    expect(ac?.line?.legs.map((l) => l.originIata)).toEqual(["MAD", "BCN", "LIS"]);
    expect(ac?.assignedRouteId).toBeNull();
    for (const r of result.routes) expect(r.assignedAircraftIds).toContain("ac-1");
  });

  it("ignores garbage, and a route closing clears the line", async () => {
    const garbage = await replayActionLog({
      pubkey,
      actions: [
        ...base,
        act("e6", 6, "AIRCRAFT_LINE_SET", { aircraftId: "ac-1", legs: "MAD-BCN", tick: 6 }),
      ],
    });
    expect(garbage.fleet[0]?.line ?? null).toBeNull();
    const closed = await replayActionLog({
      pubkey,
      actions: [
        ...base,
        act("e6", 6, "AIRCRAFT_LINE_SET", { aircraftId: "ac-1", legs: requests, tick: 6 }),
        act("e7", 7, "ROUTE_CLOSE", { routeId: "r2", tick: 7 }),
      ],
    });
    expect(closed.fleet[0]?.line ?? null).toBeNull();
    expect(closed.routes.some((r) => r.assignedAircraftIds.includes("ac-1"))).toBe(false);
  });
});
