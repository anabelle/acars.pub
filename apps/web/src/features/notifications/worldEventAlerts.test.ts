import { GENESIS_TIME, TICK_DURATION, TICKS_PER_HOUR } from "@acars/core";
import { describe, expect, it } from "vitest";
import { WORLD_EVENT_ALERT_WINDOW_TICKS, worldEventsStartingOnRoutes } from "./worldEventAlerts";

// The deterministic schedule starts a festival in Barcelona at 2026-10-06 09:00 UTC.
const FESTIVAL_START = (Date.parse("2026-10-06T09:00:00Z") - GENESIS_TIME) / TICK_DURATION;
const route = (originIata: string, destinationIata: string, status = "active" as const) => ({
  originIata,
  destinationIata,
  status,
});

describe("worldEventsStartingOnRoutes()", () => {
  it("finds the event that just started at an airport on the player's routes", () => {
    const alerts = worldEventsStartingOnRoutes(FESTIVAL_START - 1, FESTIVAL_START, [
      route("MAD", "BCN"),
      route("BCN", "LIS"),
      route("MAD", "JFK"),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].event).toMatchObject({ kind: "festival", airportIata: "BCN" });
    expect(alerts[0].routes).toEqual(["MAD–BCN", "BCN–LIS"]);
  });

  it("ignores events elsewhere, suspended routes and events not starting in the window", () => {
    expect(
      worldEventsStartingOnRoutes(FESTIVAL_START - 1, FESTIVAL_START, [route("MAD", "JFK")]),
    ).toEqual([]);
    expect(
      worldEventsStartingOnRoutes(FESTIVAL_START - 1, FESTIVAL_START, [
        { originIata: "MAD", destinationIata: "BCN", status: "suspended" },
      ]),
    ).toEqual([]);
    // Already running: it started before the window.
    expect(
      worldEventsStartingOnRoutes(FESTIVAL_START, FESTIVAL_START + TICKS_PER_HOUR, [
        route("MAD", "BCN"),
      ]),
    ).toEqual([]);
    expect(
      worldEventsStartingOnRoutes(FESTIVAL_START, FESTIVAL_START, [route("MAD", "BCN")]),
    ).toEqual([]);
  });

  it("looks back at most an hour, so a catch-up doesn't announce stale events", () => {
    const routes = [route("MAD", "BCN")];
    expect(
      worldEventsStartingOnRoutes(
        FESTIVAL_START - 10 * TICKS_PER_HOUR,
        FESTIVAL_START + WORLD_EVENT_ALERT_WINDOW_TICKS - 1,
        routes,
      ),
    ).toHaveLength(1);
    expect(
      worldEventsStartingOnRoutes(
        FESTIVAL_START - 10 * TICKS_PER_HOUR,
        FESTIVAL_START + WORLD_EVENT_ALERT_WINDOW_TICKS,
        routes,
      ),
    ).toEqual([]);
  });
});
