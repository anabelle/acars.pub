import type { AircraftInstance, FixedPoint, TimelineEvent } from "@acars/core";
import { fp, fpAdd, TICKS_PER_HOUR } from "@acars/core";
import type { DayLeg } from "@/shared/ui/cockpit";

const TICKS_PER_DAY = TICKS_PER_HOUR * 24;

export interface PlaneDay {
  /** Legs of the last 24 hours (hour 0 = a day ago, 24 = now), plus the one in the air. */
  legs: DayLeg[];
  /** Operating profit of the last seven days of landings. */
  profit7d: FixedPoint;
}

function toLeg(departureTick: number, arrivalTick: number, dayStart: number): DayLeg {
  return {
    startHour: (departureTick - dayStart) / TICKS_PER_HOUR,
    durationHours: (arrivalTick - departureTick) / TICKS_PER_HOUR,
  };
}

/**
 * A plane's day and week from its landings (S60), in one pass over the
 * timeline for the whole fleet: O(timeline + fleet), never per passenger.
 * Legs come from what was flown, so the strip is history, not a forecast.
 */
export function summarizeFleetDays(
  fleet: readonly Pick<AircraftInstance, "id" | "status" | "flight">[],
  timeline: readonly TimelineEvent[],
  tick: number,
): Map<string, PlaneDay> {
  // A rolling day: the strip always shows the plane's rhythm, even just after midnight.
  const dayStart = tick - TICKS_PER_DAY;
  const weekStart = tick - TICKS_PER_DAY * 7;
  const days = new Map<string, PlaneDay>();
  for (const aircraft of fleet) days.set(aircraft.id, { legs: [], profit7d: fp(0) });

  for (const event of timeline) {
    if (event.type !== "landing" || !event.aircraftId) continue;
    const day = days.get(event.aircraftId);
    if (!day || event.tick > tick) continue;
    if (event.tick >= weekStart && event.profit !== undefined) {
      day.profit7d = fpAdd(day.profit7d, event.profit);
    }
    const duration = event.details?.flightDurationTicks;
    if (duration && event.tick > dayStart) {
      day.legs.push(toLeg(event.tick - duration, event.tick, dayStart));
    }
  }

  for (const aircraft of fleet) {
    const flight = aircraft.flight;
    if (aircraft.status !== "enroute" || !flight) continue;
    const day = days.get(aircraft.id);
    if (day && flight.arrivalTick > dayStart) {
      day.legs.push(toLeg(flight.departureTick, Math.min(flight.arrivalTick, tick), dayStart));
    }
  }
  for (const day of days.values()) day.legs.sort((a, b) => a.startHour - b.startHour);
  return days;
}

/** The plane with the best positive seven-day profit, if any. */
export function topEarnerId(days: ReadonlyMap<string, PlaneDay>): string | null {
  let best: string | null = null;
  let bestProfit = 0;
  for (const [id, day] of days) {
    if (day.profit7d > bestProfit) {
      best = id;
      bestProfit = day.profit7d;
    }
  }
  return best;
}
