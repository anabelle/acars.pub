import type { AircraftInstance, Route } from "@acars/core";
import { fp, GENESIS_TIME, TICK_DURATION, TICKS_PER_DAY, TICKS_PER_HOUR } from "@acars/core";
import { getAircraftById, setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { reconcileFleetToTick } from "./FlightEngine";
import { buildLineLegs, type LineLegRequest } from "./lineEngine";
import { tickHourKey, useWeatherStore, weatherAt } from "./weather";

const H = TICKS_PER_HOUR;
const storm = { category: 3 as const, gustKt: 40, thunderstorm: true, fog: false, snow: false };

beforeAll(() => setAirportsCatalog(airports));
afterEach(() => useWeatherStore.setState({ hours: new Map() }));

describe("weather store", () => {
  it("keys ticks by UTC hour and answers per airport", () => {
    const tick = (Date.UTC(2026, 9, 12, 14, 30) - GENESIS_TIME) / TICK_DURATION;
    expect(tickHourKey(tick)).toBe("2026101214");
    useWeatherStore.getState().setHours(new Map([["2026101214", new Map([["DFW", storm]])]]));
    expect(weatherAt("DFW", tick)).toEqual(storm);
    expect(weatherAt("MAD", tick)).toBeNull();
    expect(weatherAt("DFW", tick + 2 * H)).toBeNull();
  });

  it("keeps two days of bundles at most", () => {
    const hours = new Map(
      Array.from({ length: 60 }, (_, i) => [`2026101${String(i).padStart(3, "0")}`, new Map()]),
    );
    useWeatherStore.getState().setHours(hours);
    expect(useWeatherStore.getState().hours.size).toBe(48);
  });
});

describe("weather in the engine", () => {
  it("delays line departures from a stormy airport and records why", () => {
    const route = {
      id: "r1",
      originIata: "MAD",
      destinationIata: "BCN",
      distanceKm: 483,
      airlinePubkey: "me",
      assignedAircraftIds: ["ac-1"],
      fareEconomy: fp(150),
      fareBusiness: fp(450),
      fareFirst: fp(800),
      status: "active",
    } as Route;
    const requests: LineLegRequest[] = [
      { routeId: "r1", direction: "outbound", departOffsetTicks: 8 * H },
      { routeId: "r1", direction: "inbound", departOffsetTicks: 12 * H },
    ];
    const built = buildLineLegs(requests, new Map([["r1", route]]), getAircraftById("a320neo")!);
    const start = 700 * TICKS_PER_DAY;
    const plane = {
      id: "ac-1",
      modelId: "a320neo",
      name: "Q",
      status: "idle",
      assignedRouteId: null,
      baseAirportIata: "MAD",
      configuration: { economy: 180, business: 0, first: 0, cargoKg: 0 },
      flightHoursTotal: 0,
      flightHoursSinceCheck: 0,
      condition: 1,
      line: { legs: built.legs!, startTick: start },
      lastTickProcessed: start,
    } as unknown as AircraftInstance;
    const hours = new Map<string, Map<string, typeof storm>>();
    for (let t = start; t < start + 2 * TICKS_PER_DAY; t += H)
      hours.set(tickHourKey(t), new Map([["MAD", storm]]));
    useWeatherStore.getState().setHours(hours);
    const { events } = reconcileFleetToTick([plane], [route], start + 2 * TICKS_PER_DAY);
    const fromMad = events.filter((e) => e.type === "landing" && e.originIata === "MAD");
    expect(fromMad.length).toBeGreaterThan(0);
    expect(fromMad.every((e) => (e.details?.weatherDelayTicks ?? 0) > 0)).toBe(true);
    const fromBcn = events.filter((e) => e.type === "landing" && e.originIata === "BCN");
    expect(fromBcn.every((e) => !e.details?.weatherDelayTicks)).toBe(true);
  });
});
