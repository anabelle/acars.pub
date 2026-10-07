import { describe, expect, it } from "vitest";
import { TICKS_PER_DAY, TICKS_PER_HOUR } from "./types.js";
import {
  eventDemandMultiplier,
  eventFeesMultiplier,
  eventFuelMultiplier,
  eventRemainingMs,
  getActiveEvents,
  getEventsForDay,
  getUpcomingEvents,
  MAX_EVENT_DEMAND,
  MAX_EVENT_FEES,
  MAX_EVENT_FUEL,
  MIN_EVENT_DEMAND,
  WORLD_EVENT_TEMPLATES,
  type WorldEvent,
} from "./worldEvents.js";

const DAYS = Array.from({ length: 365 }, (_, i) => 600 + i);

describe("world event schedule", () => {
  it("is deterministic per day and pinned (a change would desync clients)", () => {
    expect(getEventsForDay(600)).toEqual(getEventsForDay(600));
    expect(
      getEventsForDay(600).map((e) => [e.kind, e.airportIata, e.startTick, e.endTick]),
    ).toMatchInlineSnapshot(`
      [
        [
          "festival",
          "LAS",
          17284800,
          17352000,
        ],
      ]
    `);
  });

  it("draws one or two well-formed events a day", () => {
    for (const day of DAYS) {
      const events = getEventsForDay(day);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.length).toBeLessThanOrEqual(2);
      expect(new Set(events.map((e) => e.kind)).size).toBe(events.length);
      for (const [index, event] of events.entries()) {
        const template = WORLD_EVENT_TEMPLATES.find((t) => t.kind === event.kind);
        expect(template).toBeDefined();
        expect(event.id).toBe(`${day}:${index}`);
        expect(event.startTick).toBeGreaterThanOrEqual(day * TICKS_PER_DAY);
        expect(event.startTick).toBeLessThan((day + 1) * TICKS_PER_DAY);
        const hours = (event.endTick - event.startTick) / TICKS_PER_HOUR;
        expect(hours).toBeGreaterThanOrEqual(template!.hours[0]);
        expect(hours).toBeLessThanOrEqual(template!.hours[1]);
        if (template!.airports.length === 0) expect(event.airportIata).toBeNull();
        else expect(template!.airports).toContain(event.airportIata);
      }
      if (events.length === 2 && events[0].airportIata !== null) {
        expect(events[1].airportIata).not.toBe(events[0].airportIata);
      }
    }
  });

  it("uses every kind over a year", () => {
    const kinds = new Set(DAYS.flatMap((day) => getEventsForDay(day).map((e) => e.kind)));
    expect(kinds.size).toBe(WORLD_EVENT_TEMPLATES.length);
  });

  it("has nothing before genesis", () => {
    expect(getEventsForDay(-1)).toEqual([]);
    expect(getActiveEvents(0).every((e) => e.startTick >= 0)).toBe(true);
  });

  it("finds exactly the events covering a tick, including ones from earlier days", () => {
    const all = DAYS.flatMap((day) => getEventsForDay(day));
    for (let tick = 640 * TICKS_PER_DAY; tick < 660 * TICKS_PER_DAY; tick += 5 * TICKS_PER_HOUR) {
      const expected = all.filter((e) => tick >= e.startTick && tick < e.endTick).map((e) => e.id);
      expect(
        getActiveEvents(tick)
          .map((e) => e.id)
          .sort(),
      ).toEqual(expected.sort());
    }
  });

  it("never stacks up: at most a handful active at once", () => {
    let most = 0;
    for (let tick = 600 * TICKS_PER_DAY; tick < 965 * TICKS_PER_DAY; tick += TICKS_PER_HOUR) {
      most = Math.max(most, getActiveEvents(tick).length);
    }
    expect(most).toBeLessThanOrEqual(6);
  });

  it("lists upcoming events in the window", () => {
    const tick = 700 * TICKS_PER_DAY;
    const upcoming = getUpcomingEvents(tick, 2 * TICKS_PER_DAY);
    expect(upcoming.length).toBeGreaterThan(0);
    for (const event of upcoming) {
      expect(event.startTick).toBeGreaterThan(tick);
      expect(event.startTick).toBeLessThanOrEqual(tick + 2 * TICKS_PER_DAY);
    }
  });
});

describe("event effects", () => {
  const event = (overrides: Partial<WorldEvent>): WorldEvent => ({
    id: "x",
    kind: "festival",
    airportIata: "BCN",
    startTick: 0,
    endTick: 100,
    demandMultiplier: 1,
    feesMultiplier: 1,
    fuelMultiplier: 1,
    ...overrides,
  });

  it("applies to routes touching the airport, either end", () => {
    const festival = [event({ demandMultiplier: 1.3 })];
    expect(eventDemandMultiplier(festival, "MAD", "BCN")).toBeCloseTo(1.3);
    expect(eventDemandMultiplier(festival, "BCN", "LIS")).toBeCloseTo(1.3);
    expect(eventDemandMultiplier(festival, "MAD", "LIS")).toBe(1);
  });

  it("clamps stacked effects", () => {
    const stacked = [
      event({ demandMultiplier: 1.5, feesMultiplier: 1.4 }),
      event({ airportIata: "MAD", demandMultiplier: 1.5, feesMultiplier: 1.4 }),
    ];
    expect(eventDemandMultiplier(stacked, "MAD", "BCN")).toBe(MAX_EVENT_DEMAND);
    expect(eventFeesMultiplier(stacked, "MAD", "BCN")).toBe(MAX_EVENT_FEES);
    const strikes = [
      event({ demandMultiplier: 0.7 }),
      event({ airportIata: "MAD", demandMultiplier: 0.7 }),
    ];
    expect(eventDemandMultiplier(strikes, "MAD", "BCN")).toBe(MIN_EVENT_DEMAND);
  });

  it("fuel spikes are global; airport events don't touch fuel", () => {
    expect(eventFuelMultiplier([event({ fuelMultiplier: 1.15 })])).toBe(1);
    const spikes = [
      event({ airportIata: null, fuelMultiplier: 1.15 }),
      event({ airportIata: null, fuelMultiplier: 1.15 }),
    ];
    expect(eventFuelMultiplier(spikes)).toBe(MAX_EVENT_FUEL);
    expect(eventFeesMultiplier([], "MAD", "BCN")).toBe(1);
  });

  it("every catalog magnitude stays inside the bounds", () => {
    for (const template of WORLD_EVENT_TEMPLATES) {
      expect(template.demandMultiplier).toBeGreaterThanOrEqual(MIN_EVENT_DEMAND);
      expect(template.demandMultiplier).toBeLessThanOrEqual(MAX_EVENT_DEMAND);
      expect(template.feesMultiplier).toBeLessThanOrEqual(MAX_EVENT_FEES);
      expect(template.fuelMultiplier).toBeLessThanOrEqual(MAX_EVENT_FUEL);
    }
  });

  it("reports time remaining", () => {
    expect(eventRemainingMs(event({ endTick: 100 }), 40)).toBe(60 * 3000);
    expect(eventRemainingMs(event({ endTick: 100 }), 200)).toBe(0);
  });
});
