import type { AircraftInstance, Airport, Route } from "@acars/core";
import { fp, TICKS_PER_DAY, TICKS_PER_HOUR } from "@acars/core";
import { getAirports, setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { beforeAll, describe, expect, it } from "vitest";
import { buildConnectionService, computeConnectionService, legKey } from "./connections";
import { computeFlightPassengers } from "./FlightEngine";

const H = TICKS_PER_HOUR;
let byIata: Map<string, Airport>;
const airport = (iata: string) => byIata.get(iata);
const route = (id: string, o: string, d: string, km = 500): Route =>
  ({
    id,
    originIata: o,
    destinationIata: d,
    distanceKm: km,
    airlinePubkey: "me",
    assignedAircraftIds: [],
    fareEconomy: fp(150),
    fareBusiness: fp(450),
    fareFirst: fp(800),
    status: "active",
    frequencyPerWeek: 14,
  }) as Route;
const tick = 500 * TICKS_PER_DAY;

beforeAll(() => {
  setAirportsCatalog(airports);
  byIata = new Map(getAirports().map((a) => [a.iata, a]));
});

describe("computeConnectionService", () => {
  const routes = [route("r1", "MAD", "LIS"), route("r2", "MAD", "BCN"), route("r3", "MAD", "SVQ")];

  it("carries connecting passengers on both legs of every pair through the hub", () => {
    const service = computeConnectionService(routes, [], tick, airport);
    const hub = service.hubs.get("MAD");
    expect(hub?.weekly).toBeGreaterThan(0);
    expect(hub?.quality).toBe(0.5);
    for (const key of [
      legKey("LIS", "MAD"),
      legKey("MAD", "BCN"),
      legKey("BCN", "MAD"),
      legKey("MAD", "LIS"),
    ]) {
      const pax = service.byLeg.get(key);
      expect((pax?.economy ?? 0) + (pax?.business ?? 0)).toBeGreaterThan(0);
    }
    expect(hub?.pairs.length).toBeGreaterThan(0);
  });

  it("does not connect a pair the airline flies direct", () => {
    const withDirect = computeConnectionService(
      [...routes, route("r4", "LIS", "BCN", 1000)],
      [],
      tick,
      airport,
    );
    expect(
      withDirect.hubs
        .get("MAD")
        ?.pairs.some((p) => p.originIata === "LIS" && p.destinationIata === "BCN"),
    ).toBe(false);
  });

  it("connects more when arrivals and departures form a bank", () => {
    const random = computeConnectionService(routes, [], tick, airport).hubs.get("MAD")!;
    const leg = (o: string, d: string, dep: number) => ({
      routeId: "x",
      originIata: o,
      destinationIata: d,
      departOffsetTicks: dep,
      durationTicks: H,
      turnaroundTicks: 0,
    });
    const banked = [
      { line: { startTick: 0, legs: [leg("LIS", "MAD", 7 * H), leg("MAD", "BCN", 9 * H)] } },
      { line: { startTick: 0, legs: [leg("BCN", "MAD", 7 * H), leg("MAD", "LIS", 9 * H)] } },
    ] as Pick<AircraftInstance, "line">[];
    const timed = computeConnectionService(routes, banked, tick, airport).hubs.get("MAD")!;
    expect(timed.quality).toBe(1);
    expect(timed.weekly).toBeGreaterThan(random.weekly);
  });

  it("is cached per hour and identical when recomputed", () => {
    const a = buildConnectionService(routes, [], tick, airport);
    expect(buildConnectionService(routes, [], tick + 10, airport)).toBe(a);
    const b = computeConnectionService(routes, [], tick, airport);
    expect([...b.byLeg.entries()]).toEqual([...a.byLeg.entries()]);
  });
});

describe("computeFlightPassengers with connections", () => {
  it("fills more seats and reports the connecting share", () => {
    const base = {
      originIata: "LIS",
      destinationIata: "MAD",
      tick,
      seatConfig: { economy: 180, business: 0, first: 0 },
      model: { speedKmh: 830, turnaroundTimeMinutes: 45, blockHoursPerDay: 14 },
      route: route("r1", "MAD", "LIS"),
      competitorOffers: [],
      playerPubkey: "me",
      playerBrandScore: 0.5,
      distanceLimitKm: Number.POSITIVE_INFINITY,
    };
    const alone = computeFlightPassengers(base);
    const connected = computeFlightPassengers({
      ...base,
      connecting: { economy: 400, business: 0, first: 0 },
    });
    expect(alone.connectingShare).toBe(0);
    expect(connected.connectingShare).toBeGreaterThan(0);
    expect(connected.passengersEconomy).toBeGreaterThanOrEqual(alone.passengersEconomy);
  });
});
