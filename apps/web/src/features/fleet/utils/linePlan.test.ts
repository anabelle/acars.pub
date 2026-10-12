import type { Route } from "@acars/core";
import { fp, TICKS_PER_HOUR, validateLine } from "@acars/core";
import { getAircraftById } from "@acars/data";
import { describe, expect, it } from "vitest";
import {
  autoFillLine,
  DEFAULT_FIRST_DEPARTURE,
  defaultDeparture,
  formatOffset,
  isWorking,
  nextLegOptions,
  planLine,
} from "./linePlan";

const H = TICKS_PER_HOUR;
const model = getAircraftById("a320neo")!;
const route = (id: string, o: string, d: string, km: number, status = "active"): Route =>
  ({
    id,
    originIata: o,
    destinationIata: d,
    distanceKm: km,
    airlinePubkey: "me",
    assignedAircraftIds: [],
    fareEconomy: fp(1),
    fareBusiness: fp(1),
    fareFirst: fp(1),
    status,
  }) as Route;
const routes = [
  route("r1", "MAD", "BCN", 483),
  route("r2", "BCN", "LIS", 1000),
  route("r3", "MAD", "LIS", 513),
  route("r4", "MAD", "SYD", 17_600),
  route("r5", "MAD", "PMI", 550, "closed"),
];

describe("nextLegOptions", () => {
  it("lists active, in-range routes touching the airport, both ways", () => {
    expect(
      nextLegOptions("MAD", routes, model).map((o) => `${o.routeId}:${o.destinationIata}`),
    ).toEqual(["r1:BCN", "r3:LIS"]);
    expect(
      nextLegOptions("LIS", routes, model).map((o) => `${o.direction}:${o.destinationIata}`),
    ).toEqual(["inbound:BCN", "inbound:MAD"]);
  });
});

describe("planLine", () => {
  it("checks a draft as the replay will and measures its buffers", () => {
    const first = DEFAULT_FIRST_DEPARTURE;
    const draft = [
      { routeId: "r1", direction: "outbound" as const, departOffsetTicks: first },
      { routeId: "r1", direction: "inbound" as const, departOffsetTicks: first + 3 * H },
    ];
    const plan = planLine(draft, routes, model, "MAD");
    expect(plan.error).toBeNull();
    expect(plan.buffers).toHaveLength(2);
    expect(plan.buffers[0]).toBeGreaterThan(0);
    expect(planLine(draft.slice(0, 1), routes, model, "MAD").error).toBe("not-closed");
    expect(planLine(draft, routes, model, "BCN").error).toBe("not-at-start");
  });

  it("suggests the next departure after the plane is ready, on a 5-minute step", () => {
    const plan = planLine(
      [{ routeId: "r1", direction: "outbound", departOffsetTicks: DEFAULT_FIRST_DEPARTURE }],
      routes,
      model,
      "MAD",
    );
    const next = defaultDeparture(plan.legs[0]);
    const leg = plan.legs[0];
    expect(next).toBeGreaterThanOrEqual(
      leg.departOffsetTicks + leg.durationTicks + leg.turnaroundTicks,
    );
    expect(next % (5 * (H / 60))).toBe(0);
    expect(defaultDeparture(undefined)).toBe(DEFAULT_FIRST_DEPARTURE);
  });
});

describe("autoFillLine", () => {
  it("fills the day with valid out-and-back trips from base", () => {
    const draft = autoFillLine("MAD", routes, model);
    expect(draft.length).toBeGreaterThanOrEqual(6);
    expect(draft.length % 2).toBe(0);
    const plan = planLine(draft, routes, model, "MAD");
    expect(plan.error).toBeNull();
    expect(validateLine(plan.legs)).toBeNull();
    expect(new Set(draft.map((leg) => leg.routeId))).toEqual(new Set(["r1", "r3"]));
  });

  it("returns nothing when no route touches the base", () => {
    expect(autoFillLine("JFK", routes, model)).toEqual([]);
  });
});

describe("helpers", () => {
  it("formats day offsets and knows when a plane is working", () => {
    expect(formatOffset(7 * H + 5 * (H / 60))).toBe("07:05");
    expect(isWorking({ assignedRouteId: null, line: null })).toBe(false);
    expect(isWorking({ assignedRouteId: "r1" })).toBe(true);
    expect(isWorking({ assignedRouteId: null, line: { legs: [1] } })).toBe(true);
  });
});
