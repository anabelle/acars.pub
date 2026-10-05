import type { AircraftInstance, TimelineEvent } from "@acars/core";
import { fp, GENESIS_TIME, TICK_DURATION, TICKS_PER_HOUR } from "@acars/core";
import { describe, expect, it } from "vitest";
import {
  cashResultSince,
  findNextLanding,
  formatCountdown,
  formatUtcClock,
  tickToUtcMs,
  utcDayStartTick,
} from "./tickerFacts";

const tickAt = (iso: string) => Math.floor((Date.parse(iso) - GENESIS_TIME) / TICK_DURATION);

const aircraft = (
  id: string,
  status: AircraftInstance["status"],
  arrivalTick: number | null,
  destinationIata = "BCN",
) =>
  ({
    id,
    name: `Plane ${id}`,
    status,
    flight:
      arrivalTick === null
        ? null
        : {
            originIata: "MAD",
            destinationIata,
            departureTick: 0,
            arrivalTick,
            direction: "outbound",
          },
  }) as unknown as AircraftInstance;

describe("tickerFacts", () => {
  it("shows the UTC wall clock for a tick", () => {
    expect(formatUtcClock(tickAt("2026-10-05T14:07:30Z"))).toBe("14:07");
    expect(formatUtcClock(tickAt("2026-10-05T00:00:00Z"))).toBe("00:00");
    expect(tickToUtcMs(0)).toBe(GENESIS_TIME);
  });

  it("finds the first tick of the UTC day", () => {
    const start = utcDayStartTick(tickAt("2026-10-05T14:07:30Z"));
    expect(new Date(tickToUtcMs(start)).toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(utcDayStartTick(start)).toBe(start);
    expect(utcDayStartTick(start - 1)).toBeLessThan(start);
  });

  it("picks the soonest landing still ahead", () => {
    const fleet = [
      aircraft("a", "enroute", 500, "LHR"),
      aircraft("b", "enroute", 300, "BCN"),
      aircraft("c", "enroute", 90),
      aircraft("d", "idle", null),
      aircraft("e", "turnaround", 200),
      aircraft("f", "enroute", 400),
    ];
    expect(findNextLanding(fleet, 100)).toEqual({
      aircraftId: "b",
      aircraftName: "Plane b",
      destinationIata: "BCN",
      arrivalTick: 300,
    });
    expect(findNextLanding(fleet, 600)).toBeNull();
    expect(findNextLanding([], 0)).toBeNull();
  });

  it("formats countdowns compactly", () => {
    expect(formatCountdown(0)).toBe("<1m");
    expect(formatCountdown(-5)).toBe("<1m");
    expect(formatCountdown(TICKS_PER_HOUR / 60)).toBe("1m");
    expect(formatCountdown(TICKS_PER_HOUR * 0.25)).toBe("15m");
    expect(formatCountdown(TICKS_PER_HOUR * 2 + 100)).toBe("2h 05m");
  });

  it("sums today's landings and lease payments", () => {
    const events = [
      { tick: 50, type: "landing", revenue: fp(1000), cost: fp(400) },
      { tick: 120, type: "landing", revenue: fp(2000), cost: fp(500) },
      { tick: 130, type: "landing" },
      { tick: 140, type: "lease_payment", cost: fp(300) },
      { tick: 150, type: "lease_payment" },
      { tick: 160, type: "delivery", cost: fp(9999) },
    ] as unknown as TimelineEvent[];
    expect(cashResultSince(events, 100)).toBe(fp(1200));
    expect(cashResultSince(events, 0)).toBe(fp(1800));
    expect(cashResultSince(undefined, 0)).toBe(fp(0));
  });
});
