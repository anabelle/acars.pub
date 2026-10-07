import { setActiveEventsOverride, TICKS_PER_HOUR, type WorldEvent } from "@acars/core";
import { afterEach, describe, expect, it } from "vitest";
import { formatEventHours, worldEventPins, worldEventsBoard } from "./worldEventsView";

const event = (overrides: Partial<WorldEvent>): WorldEvent => ({
  id: "e",
  kind: "festival",
  airportIata: "BCN",
  startTick: 0,
  endTick: 1000,
  demandMultiplier: 1.3,
  feesMultiplier: 1,
  fuelMultiplier: 1,
  ...overrides,
});

afterEach(() => setActiveEventsOverride(null));

describe("worldEventsBoard()", () => {
  it("flags the player's routes an event touches and puts those first", () => {
    setActiveEventsOverride([
      event({ id: "far", airportIata: "SYD", endTick: 200 }),
      event({ id: "mine", airportIata: "BCN", endTick: 900 }),
      event({
        id: "fuel",
        kind: "fuelSpike",
        airportIata: null,
        demandMultiplier: 1,
        fuelMultiplier: 1.15,
        endTick: 500,
      }),
    ]);
    const board = worldEventsBoard(100, [
      { originIata: "MAD", destinationIata: "BCN" },
      { originIata: "MAD", destinationIata: "LIS" },
    ]);
    expect(board.active.map((v) => v.event.id)).toEqual(["fuel", "mine", "far"]);
    expect(board.active[0].yourRoutes).toEqual(["MAD–BCN", "MAD–LIS"]);
    expect(board.active[1]).toMatchObject({
      yourRoutes: ["MAD–BCN"],
      demandPct: 30,
      ticksLeft: 800,
    });
    expect(board.active[0].fuelPct).toBe(15);
    expect(board.active[2].yourRoutes).toEqual([]);
  });

  it("lists events starting within a day from the real schedule", () => {
    const tick = 700 * 24 * TICKS_PER_HOUR;
    const board = worldEventsBoard(tick, []);
    for (const upcoming of board.upcoming) {
      expect(upcoming.ticksLeft).toBeGreaterThan(0);
      expect(upcoming.ticksLeft).toBeLessThanOrEqual(24 * TICKS_PER_HOUR);
    }
  });
});

describe("worldEventPins()", () => {
  it("places airport events and skips global or unknown ones", () => {
    const pins = worldEventPins(
      [
        event({ id: "a", airportIata: "BCN" }),
        event({ id: "b", airportIata: null }),
        event({ id: "c", airportIata: "XXX" }),
      ],
      (iata) => (iata === "BCN" ? { longitude: 2.08, latitude: 41.3 } : undefined),
    );
    expect(pins).toEqual([
      { id: "a", kind: "festival", iata: "BCN", longitude: 2.08, latitude: 41.3 },
    ]);
  });
});

describe("formatEventHours()", () => {
  it("shows hours, or minutes under an hour", () => {
    expect(formatEventHours(18 * TICKS_PER_HOUR)).toBe("18h");
    expect(formatEventHours(TICKS_PER_HOUR / 2)).toBe("30m");
    expect(formatEventHours(-5)).toBe("0m");
  });
});
