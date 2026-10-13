import type { Route } from "@acars/core";
import { describe, expect, it } from "vitest";
import { aircraftDuty } from "./duty";

const route = { id: "r1", originIata: "MAD", destinationIata: "BCN" } as Route;
const find = (id: string) => (id === route.id ? route : undefined);
const leg = (originIata: string, destinationIata: string) => ({
  routeId: "r",
  originIata,
  destinationIata,
  departOffsetTicks: 0,
  durationTicks: 1,
  turnaroundTicks: 1,
});

describe("aircraftDuty", () => {
  it("names a day plan by its airports, ahead of any single route", () => {
    const duty = aircraftDuty(
      {
        assignedRouteId: "r1",
        baseAirportIata: "MAD",
        line: { legs: [leg("MAD", "BCN"), leg("BCN", "LIS"), leg("LIS", "MAD")], startTick: 0 },
      },
      find,
    );
    expect(duty).toEqual({ kind: "line", airports: ["MAD", "BCN", "LIS", "MAD"] });
  });

  it("names the single route a plane flies back and forth", () => {
    expect(
      aircraftDuty({ assignedRouteId: "r1", baseAirportIata: "MAD", line: null }, find),
    ).toEqual({ kind: "route", route });
  });

  it("calls a plane with no route, or a route that is gone, parked", () => {
    expect(aircraftDuty({ assignedRouteId: null, baseAirportIata: "MAD" }, find)).toEqual({
      kind: "parked",
      airport: "MAD",
    });
    expect(aircraftDuty({ assignedRouteId: "gone", baseAirportIata: "BCN" }, find).kind).toBe(
      "parked",
    );
  });
});
