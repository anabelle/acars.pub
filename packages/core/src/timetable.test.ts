import { describe, expect, it } from "vitest";
import { fp } from "./fixed-point.js";
import { utcDayOf, utcDayStartTick } from "./line.js";
import {
  applyRouteChange,
  isPublished,
  JOIN_GRACE_TICKS,
  nextUtcDayStartTick,
  offerAt,
  routeAt,
  scheduleChangeTiming,
} from "./timetable.js";
import type { FlightOffer, Route } from "./types.js";
import { TICKS_PER_HOUR } from "./types.js";

const DAY = 40;
const today = utcDayStartTick(DAY);
const noon = today + 12 * TICKS_PER_HOUR;
const tomorrow = utcDayStartTick(DAY + 1);

function route(extra: Partial<Route> = {}): Route {
  return {
    id: "r1",
    originIata: "MAD",
    destinationIata: "BCN",
    airlinePubkey: "me",
    distanceKm: 480,
    frequencyPerWeek: 14,
    openedAtTick: today - 5 * TICKS_PER_HOUR,
    assignedAircraftIds: [],
    fareEconomy: fp(100),
    fareBusiness: fp(300),
    fareFirst: fp(600),
    status: "active",
    ...extra,
  };
}

const offer: FlightOffer = {
  airlinePubkey: "rival",
  fareEconomy: fp(90),
  fareBusiness: fp(280),
  fareFirst: fp(550),
  frequencyPerWeek: 7,
  travelTimeMinutes: 80,
  stops: 0,
  serviceScore: 0.7,
  brandScore: 0.5,
};

describe("days", () => {
  it("finds the next 00:00 UTC", () => {
    expect(nextUtcDayStartTick(noon)).toBe(tomorrow);
    expect(nextUtcDayStartTick(today)).toBe(tomorrow);
    expect(nextUtcDayStartTick(tomorrow - 1)).toBe(tomorrow);
    expect(utcDayOf(tomorrow)).toBe(DAY + 1);
  });

  it("calls a route published once it was opened before today", () => {
    expect(isPublished(route(), noon)).toBe(true);
    expect(isPublished(route({ openedAtTick: today + 1 }), noon)).toBe(false);
    expect(isPublished(route({ openedAtTick: today }), noon)).toBe(false);
    expect(isPublished(route({ openedAtTick: undefined }), noon)).toBe(true);
  });
});

describe("routeAt and offerAt", () => {
  const announced = route({ pending: { effectiveTick: tomorrow, fareEconomy: fp(80) } });

  it("keeps today's values until the change is due", () => {
    expect(routeAt(announced, tomorrow - 1)).toBe(announced);
    expect(routeAt(route(), tomorrow)).toEqual(route());
  });

  it("applies the change from its tick, and only the changed fields", () => {
    const due = routeAt(announced, tomorrow);
    expect(due.fareEconomy).toBe(fp(80));
    expect(due.fareBusiness).toBe(fp(300));
    expect(due.pending).toBeUndefined();
  });

  it("does the same for rivals' offers", () => {
    const next = { ...offer, next: { effectiveTick: tomorrow, frequencyPerWeek: 14 } };
    expect(offerAt(offer, tomorrow)).toBe(offer);
    expect(offerAt(next, tomorrow - 1)).toBe(next);
    const due = offerAt(next, tomorrow);
    expect(due.frequencyPerWeek).toBe(14);
    expect(due.fareEconomy).toBe(fp(90));
    expect(due.next).toBeUndefined();
  });
});

describe("scheduleChangeTiming", () => {
  it("waits for tomorrow on a published route", () => {
    expect(scheduleChangeTiming(route(), { fareEconomy: fp(80) }, noon)).toEqual({
      when: "tomorrow",
      effectiveTick: tomorrow,
    });
  });

  it("applies now on a route opened today", () => {
    expect(
      scheduleChangeTiming(route({ openedAtTick: today + 2 }), { fareEconomy: fp(80) }, noon),
    ).toEqual({ when: "now", reason: "unpublished" });
  });

  it("flies a frequency rise at once right after a plane joins", () => {
    const join = noon - 10;
    expect(scheduleChangeTiming(route(), { frequencyPerWeek: 21 }, noon, join)).toEqual({
      when: "now",
      reason: "newCapacity",
    });
    // Cuts, fares, stale joins and joins "from the future" still wait.
    expect(scheduleChangeTiming(route(), { frequencyPerWeek: 7 }, noon, join).when).toBe(
      "tomorrow",
    );
    expect(
      scheduleChangeTiming(route(), { frequencyPerWeek: 21, fareEconomy: fp(1) }, noon, join).when,
    ).toBe("tomorrow");
    expect(
      scheduleChangeTiming(route(), { frequencyPerWeek: 21 }, noon, noon - JOIN_GRACE_TICKS - 1)
        .when,
    ).toBe("tomorrow");
    expect(scheduleChangeTiming(route(), { frequencyPerWeek: 21 }, noon, noon + 1).when).toBe(
      "tomorrow",
    );
    expect(scheduleChangeTiming(route(), { frequencyPerWeek: 21 }, noon).when).toBe("tomorrow");
    expect(
      scheduleChangeTiming(
        route({ frequencyPerWeek: undefined }),
        { frequencyPerWeek: 3 },
        noon,
        join,
      ).when,
    ).toBe("now");
  });
});

describe("applyRouteChange", () => {
  it("announces a change on a published route", () => {
    const next = applyRouteChange(route(), { fareEconomy: fp(80) }, noon);
    expect(next.fareEconomy).toBe(fp(100));
    expect(next.pending).toEqual({ effectiveTick: tomorrow, fareEconomy: fp(80) });
  });

  it("merges a second change the same day", () => {
    const first = applyRouteChange(route(), { fareEconomy: fp(80) }, noon);
    const second = applyRouteChange(first, { frequencyPerWeek: 7, fareEconomy: fp(85) }, noon + 5);
    expect(second.pending).toEqual({
      effectiveTick: tomorrow,
      fareEconomy: fp(85),
      frequencyPerWeek: 7,
    });
  });

  it("drops an announcement set back to today's values", () => {
    const first = applyRouteChange(route(), { fareEconomy: fp(80) }, noon);
    const back = applyRouteChange(first, { fareEconomy: fp(100) }, noon + 5);
    expect(back.pending).toBeUndefined();
    expect("pending" in back).toBe(false);
    expect(back.fareEconomy).toBe(fp(100));
  });

  it("puts a due announcement in force before the next change", () => {
    const first = applyRouteChange(route(), { fareEconomy: fp(80) }, noon);
    const later = applyRouteChange(first, { fareBusiness: fp(250) }, tomorrow + 10);
    expect(later.fareEconomy).toBe(fp(80));
    expect(later.fareBusiness).toBe(fp(300));
    expect(later.pending).toEqual({
      effectiveTick: utcDayStartTick(DAY + 2),
      fareBusiness: fp(250),
    });
  });

  it("applies now on a route opened today", () => {
    const fresh = route({ openedAtTick: today + 3 });
    const next = applyRouteChange(fresh, { fareEconomy: fp(80), frequencyPerWeek: 21 }, noon);
    expect(next.fareEconomy).toBe(fp(80));
    expect(next.frequencyPerWeek).toBe(21);
    expect(next.pending).toBeUndefined();
  });

  it("lets new capacity override an announced frequency, keeping announced fares", () => {
    const announced = applyRouteChange(route(), { frequencyPerWeek: 7, fareEconomy: fp(80) }, noon);
    const joined = applyRouteChange(announced, { frequencyPerWeek: 28 }, noon + 20, noon + 10);
    expect(joined.frequencyPerWeek).toBe(28);
    expect(joined.pending).toEqual({ effectiveTick: tomorrow, fareEconomy: fp(80) });
    const onlyFrequency = applyRouteChange(
      applyRouteChange(route(), { frequencyPerWeek: 7 }, noon),
      { frequencyPerWeek: 28 },
      noon + 20,
      noon + 10,
    );
    expect(onlyFrequency.pending).toBeUndefined();
  });
});
