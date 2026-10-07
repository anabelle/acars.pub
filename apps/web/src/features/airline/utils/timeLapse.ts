import type { AircraftInstance, TimelineEvent } from "@acars/core";
import { TICK_DURATION } from "@acars/core";

/**
 * Time-lapse of an absence (S55.3): the flights that landed while the player
 * was away, replayed on the map much faster than real time. Cosmetic only:
 * it reads the timeline the engine already wrote and never touches game
 * time or state (Rule 2).
 */

/** One flight leg rebuilt from its landing event. */
export interface ReplayLeg {
  id: string;
  aircraftId: string;
  originIata: string;
  destinationIata: string;
  departureTick: number;
  arrivalTick: number;
}

export interface TimeLapse {
  legs: ReplayLeg[];
  /** Replay window, engine ticks (fractional ticks are fine). */
  startTick: number;
  endTick: number;
  /** Game time shown per real second (60 = one minute a second). */
  speed: number;
  /** How long the replay plays, ms. */
  durationMs: number;
}

/** Never slower than 60×: an hour plays in a minute. */
export const TIME_LAPSE_MIN_SPEED = 60;
/** Never longer than this, whatever the absence: speed rises to fit. */
export const TIME_LAPSE_MAX_MS = 30_000;

/**
 * Legs that landed in (fromTick, toTick], from landing events carrying a
 * flight duration. O(events); sorted by departure.
 */
export function replayLegs(
  events: readonly TimelineEvent[],
  fromTick: number,
  toTick: number,
): ReplayLeg[] {
  const legs: ReplayLeg[] = [];
  for (const event of events) {
    if (event.type !== "landing" || event.tick <= fromTick || event.tick > toTick) continue;
    const duration = event.details?.flightDurationTicks ?? 0;
    if (duration <= 0 || !event.originIata || !event.destinationIata) continue;
    legs.push({
      id: event.id,
      aircraftId: event.aircraftId ?? event.id,
      originIata: event.originIata,
      destinationIata: event.destinationIata,
      departureTick: event.tick - duration,
      arrivalTick: event.tick,
    });
  }
  return legs.sort((a, b) => a.departureTick - b.departureTick || a.id.localeCompare(b.id));
}

/**
 * The replay of an absence, or null when nothing flew. It starts at the
 * first departure (or the start of the absence, for flights already in the
 * air) and ends at the last landing.
 */
export function buildTimeLapse(
  events: readonly TimelineEvent[],
  fromTick: number,
  toTick: number,
): TimeLapse | null {
  const legs = replayLegs(events, fromTick, toTick);
  if (legs.length === 0) return null;
  let firstDeparture = Number.POSITIVE_INFINITY;
  let lastArrival = Number.NEGATIVE_INFINITY;
  for (const leg of legs) {
    firstDeparture = Math.min(firstDeparture, leg.departureTick);
    lastArrival = Math.max(lastArrival, leg.arrivalTick);
  }
  const startTick = Math.max(fromTick, firstDeparture);
  const endTick = lastArrival;
  const spanMs = Math.max(0, endTick - startTick) * TICK_DURATION;
  const speed = Math.max(TIME_LAPSE_MIN_SPEED, spanMs / TIME_LAPSE_MAX_MS);
  return { legs, startTick, endTick, speed, durationMs: spanMs / speed };
}

/** The replayed tick `elapsedMs` into the replay (clamped to its window). */
export function timeLapseTick(lapse: TimeLapse, elapsedMs: number): number {
  const tick = lapse.startTick + (Math.max(0, elapsedMs) * lapse.speed) / TICK_DURATION;
  return Math.min(lapse.endTick, tick);
}

/** Indices of the legs in the air at `tick` (departed, not yet landed). O(legs). */
export function legsInAir(lapse: TimeLapse, tick: number): number[] {
  const active: number[] = [];
  lapse.legs.forEach((leg, index) => {
    if (leg.departureTick <= tick && tick < leg.arrivalTick) active.push(index);
  });
  return active;
}

/**
 * Stand-in aircraft the globe can draw for the given legs: the real aircraft
 * (for its model and so its icon) flying the replayed leg. Legs whose
 * aircraft has since left the fleet borrow `fallback`'s model.
 */
export function replayFleet(
  lapse: TimeLapse,
  indices: readonly number[],
  fleetById: ReadonlyMap<string, AircraftInstance>,
  fallback: AircraftInstance | undefined,
): AircraftInstance[] {
  const planes: AircraftInstance[] = [];
  for (const index of indices) {
    const leg = lapse.legs[index];
    const base = fleetById.get(leg.aircraftId) ?? fallback;
    if (!base) continue;
    planes.push({
      ...base,
      id: `replay-${leg.id}`,
      status: "enroute",
      flight: {
        originIata: leg.originIata,
        destinationIata: leg.destinationIata,
        departureTick: leg.departureTick,
        arrivalTick: leg.arrivalTick,
        direction: "outbound",
      },
    });
  }
  return planes;
}
