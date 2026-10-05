import type { AircraftInstance, FixedPoint, TimelineEvent } from "@acars/core";
import { fp, fpAdd, fpSub, GENESIS_TIME, TICK_DURATION, TICKS_PER_HOUR } from "@acars/core";

const MS_PER_DAY = 86_400_000;
const TICKS_PER_MINUTE = TICKS_PER_HOUR / 60;

/** Wall-clock time of a tick (game time is real UTC time). */
export function tickToUtcMs(tick: number): number {
  return GENESIS_TIME + tick * TICK_DURATION;
}

/** "HH:MM" in UTC for a tick. */
export function formatUtcClock(tick: number): string {
  const date = new Date(tickToUtcMs(tick));
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** First tick of the UTC day that contains `tick`. */
export function utcDayStartTick(tick: number): number {
  const ms = tickToUtcMs(tick);
  const midnight = ms - (((ms % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY);
  return Math.ceil((midnight - GENESIS_TIME) / TICK_DURATION);
}

export interface NextLanding {
  aircraftId: string;
  aircraftName: string;
  destinationIata: string;
  arrivalTick: number;
}

/** The player's soonest landing still ahead of `tick`, or null. O(fleet). */
export function findNextLanding(
  fleet: readonly AircraftInstance[],
  tick: number,
): NextLanding | null {
  let next: NextLanding | null = null;
  for (const aircraft of fleet) {
    const flight = aircraft.flight;
    if (aircraft.status !== "enroute" || !flight || flight.arrivalTick <= tick) continue;
    if (next && flight.arrivalTick >= next.arrivalTick) continue;
    next = {
      aircraftId: aircraft.id,
      aircraftName: aircraft.name,
      destinationIata: flight.destinationIata,
      arrivalTick: flight.arrivalTick,
    };
  }
  return next;
}

/** Compact countdown: "2h 05m", "14m", or "<1m". */
export function formatCountdown(ticks: number): string {
  const minutes = Math.floor(Math.max(0, ticks) / TICKS_PER_MINUTE);
  if (minutes < 1) return "<1m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

/**
 * Cash result of flying since `fromTick` (inclusive): landing revenue minus
 * landing costs and lease payments, the same totals the away report uses.
 * O(timeline); the timeline is capped, so a very busy day may be partial.
 */
export function cashResultSince(
  events: readonly TimelineEvent[] | undefined,
  fromTick: number,
): FixedPoint {
  let result = fp(0);
  if (!events) return result;
  for (const event of events) {
    if (event.tick < fromTick) continue;
    if (event.type === "landing") {
      result = fpSub(fpAdd(result, event.revenue ?? fp(0)), event.cost ?? fp(0));
    } else if (event.type === "lease_payment") {
      result = fpSub(result, event.cost ?? fp(0));
    }
  }
  return result;
}
