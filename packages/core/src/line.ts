import { GENESIS_TIME, TICK_DURATION, TICKS_PER_DAY, TICKS_PER_HOUR } from "./types.js";

/**
 * Lines of flying (S66, D9): a plane flies a daily chain of legs instead of
 * one route back and forth — MAD→BCN→LIS→MAD, the same every UTC day. Each
 * leg has a scheduled departure within the day; small deterministic
 * disruptions delay departures, turnaround buffers absorb them, and what is
 * left knocks on to the next leg. Every day is independent (delays never
 * spill past the next day's first departure), so any moment is O(legs).
 */

const TICKS_PER_MINUTE = TICKS_PER_HOUR / 60;

/**
 * Ticks from UTC midnight to tick 0: the genesis is not at midnight
 * (2025-02-23 18:00Z), so a UTC day starts this many ticks before a multiple
 * of TICKS_PER_DAY.
 */
export const UTC_MIDNIGHT_OFFSET_TICKS =
  ((GENESIS_TIME % 86_400_000) / TICK_DURATION) % TICKS_PER_DAY;

/** The UTC day a tick falls in (day 0 is the genesis' UTC day). */
export function utcDayOf(tick: number): number {
  return Math.floor((tick + UTC_MIDNIGHT_OFFSET_TICKS) / TICKS_PER_DAY);
}

/** The tick of 00:00 UTC on a UTC day. */
export function utcDayStartTick(day: number): number {
  return day * TICKS_PER_DAY - UTC_MIDNIGHT_OFFSET_TICKS;
}

/** Ticks since 00:00 UTC for a tick. */
export function utcTimeOfDayTicks(tick: number): number {
  return tick - utcDayStartTick(utcDayOf(tick));
}

/** Within this much of schedule a flight counts as on time (industry: 15 min). */
export const ON_TIME_TICKS = 15 * TICKS_PER_MINUTE;

/** Most legs a plane can fly in one line. */
export const MAX_LINE_LEGS = 12;

export interface LineLeg {
  routeId: string;
  originIata: string;
  destinationIata: string;
  /** Scheduled departure, ticks after 00:00 UTC (0 ≤ offset < one day). */
  departOffsetTicks: number;
  /** Block time and turnaround of this leg for this plane (`legTicksFor`). */
  durationTicks: number;
  turnaroundTicks: number;
}

export interface LineOfFlying {
  /** Legs in flying order; the last one ends where the first one starts. */
  legs: LineLeg[];
  /** When the line was set; the first day flown is the first whose first leg departs at or after it. */
  startTick: number;
}

export type LineError =
  | "empty"
  | "too-many-legs"
  | "bad-offset"
  | "not-chained"
  | "not-closed"
  | "overlap"
  | "too-long";

/**
 * Why a line cannot be flown, or null when it can: legs in time order within
 * the day, each starting where the previous one ended, the last returning to
 * the first's origin, and every leg plus its turnaround finished before the
 * next one is scheduled (the first one of the next day included).
 */
export function validateLine(legs: readonly LineLeg[]): LineError | null {
  if (legs.length === 0) return "empty";
  if (legs.length > MAX_LINE_LEGS) return "too-many-legs";
  for (const leg of legs) {
    if (
      !Number.isInteger(leg.departOffsetTicks) ||
      leg.departOffsetTicks < 0 ||
      leg.departOffsetTicks >= TICKS_PER_DAY ||
      !(leg.durationTicks > 0) ||
      !(leg.turnaroundTicks >= 0)
    ) {
      return "bad-offset";
    }
  }
  for (let i = 1; i < legs.length; i++) {
    if (legs[i].originIata !== legs[i - 1].destinationIata) return "not-chained";
    if (legs[i].departOffsetTicks <= legs[i - 1].departOffsetTicks) return "overlap";
    const ready =
      legs[i - 1].departOffsetTicks + legs[i - 1].durationTicks + legs[i - 1].turnaroundTicks;
    if (ready > legs[i].departOffsetTicks) return "overlap";
  }
  const last = legs[legs.length - 1];
  if (last.destinationIata !== legs[0].originIata) return "not-closed";
  const lastReady = last.departOffsetTicks + last.durationTicks + last.turnaroundTicks;
  if (lastReady > legs[0].departOffsetTicks + TICKS_PER_DAY) return "too-long";
  return null;
}

/** Block plus turnaround time of a day's legs, in ticks. */
export function lineBlockTicks(legs: readonly LineLeg[]): number {
  return legs.reduce((sum, leg) => sum + leg.durationTicks, 0);
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * The disruption a departure suffers, in ticks — the same on every client:
 * about two flights in three leave on time, one in five loses 5–15 minutes,
 * a few 15–40, and one in fifty 40–90. Weather (S68) will add to this.
 */
export function departureDisruptionTicks(
  aircraftId: string,
  day: number,
  legIndex: number,
): number {
  const h = hash(`${aircraftId}:${day}:${legIndex}`);
  const u = (h % 10_000) / 10_000;
  const v = ((h >>> 14) % 1_000) / 1_000;
  let minutes = 0;
  if (u >= 0.98) minutes = 40 + v * 50;
  else if (u >= 0.89) minutes = 15 + v * 25;
  else if (u >= 0.67) minutes = 5 + v * 10;
  return Math.round(minutes) * TICKS_PER_MINUTE;
}

export interface LineFlight {
  day: number;
  legIndex: number;
  leg: LineLeg;
  scheduledDepartureTick: number;
  departureTick: number;
  arrivalTick: number;
  /** Departure minus schedule. */
  delayTicks: number;
}

/**
 * One day of a line as flown: each departure is the later of its schedule
 * and the plane being ready (previous arrival + turnaround), plus its own
 * disruption — but never so late that the rest of the day cannot finish
 * before the next day's first departure. Empty before the line's first day.
 */
export function lineDay(line: LineOfFlying, aircraftId: string, day: number): LineFlight[] {
  const { legs } = line;
  if (legs.length === 0 || day < firstLineDay(line)) return [];
  const dayStart = utcDayStartTick(day);
  const nextFirst = dayStart + TICKS_PER_DAY + legs[0].departOffsetTicks;
  // Latest departure for each leg so the remaining legs still fit before nextFirst.
  const latest: number[] = new Array(legs.length);
  let tail = nextFirst;
  for (let i = legs.length - 1; i >= 0; i--) {
    tail -= legs[i].durationTicks + legs[i].turnaroundTicks;
    latest[i] = tail;
  }
  const flights: LineFlight[] = [];
  let ready = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const scheduled = dayStart + leg.departOffsetTicks;
    const wanted = Math.max(scheduled, ready) + departureDisruptionTicks(aircraftId, day, i);
    const departureTick = Math.max(scheduled, Math.min(wanted, latest[i]));
    const arrivalTick = departureTick + leg.durationTicks;
    flights.push({
      day,
      legIndex: i,
      leg,
      scheduledDepartureTick: scheduled,
      departureTick,
      arrivalTick,
      delayTicks: departureTick - scheduled,
    });
    ready = arrivalTick + leg.turnaroundTicks;
  }
  return flights;
}

/** The first UTC day the line is flown. */
export function firstLineDay(line: LineOfFlying): number {
  const off = line.legs[0]?.departOffsetTicks ?? 0;
  return Math.ceil((line.startTick + UTC_MIDNIGHT_OFFSET_TICKS - off) / TICKS_PER_DAY);
}

export interface LinePhase {
  status: "enroute" | "turnaround" | "idle";
  /** The flight in the air, or the last one flown (null before the first). */
  flight: LineFlight | null;
  /** The next departure (when not in the air). */
  next: LineFlight | null;
  /** Where the plane is (on the ground) or is heading. */
  airportIata: string;
  turnaroundEndTick: number | null;
}

/**
 * Where a plane on a line is at `tick`: in the air, turning around after a
 * landing, or waiting on the ground for its next departure. O(legs).
 */
export function linePhaseAt(line: LineOfFlying, aircraftId: string, tick: number): LinePhase {
  const today = utcDayOf(tick);
  const flights = [
    ...lineDay(line, aircraftId, today - 1),
    ...lineDay(line, aircraftId, today),
    ...lineDay(line, aircraftId, today + 1),
  ];
  let last: LineFlight | null = null;
  for (const flight of flights) {
    if (flight.departureTick > tick) {
      if (last && tick < last.arrivalTick + last.leg.turnaroundTicks) {
        return {
          status: "turnaround",
          flight: last,
          next: flight,
          airportIata: last.leg.destinationIata,
          turnaroundEndTick: last.arrivalTick + last.leg.turnaroundTicks,
        };
      }
      return {
        status: "idle",
        flight: last,
        next: flight,
        airportIata: last ? last.leg.destinationIata : line.legs[0].originIata,
        turnaroundEndTick: null,
      };
    }
    if (tick < flight.arrivalTick) {
      return {
        status: "enroute",
        flight,
        next: null,
        airportIata: flight.leg.destinationIata,
        turnaroundEndTick: null,
      };
    }
    last = flight;
  }
  return {
    status: "idle",
    flight: last,
    next: null,
    airportIata: last ? last.leg.destinationIata : line.legs[0].originIata,
    turnaroundEndTick: null,
  };
}

/**
 * The line's landings in (fromTick, toTick], oldest first, at most `max`
 * (the newest kept). Days in between are walked one by one, so callers cap
 * long absences (`max`) — counts for any span come from `lineLandingCount`.
 */
export function lineLandingsBetween(
  line: LineOfFlying,
  aircraftId: string,
  fromTick: number,
  toTick: number,
  max = 200,
): LineFlight[] {
  if (toTick <= fromTick || line.legs.length === 0) return [];
  // Only the last days that can hold `max` landings matter.
  const daysNeeded = Math.ceil(max / line.legs.length) + 2;
  const lastDay = utcDayOf(toTick);
  const firstDay = Math.max(utcDayOf(fromTick) - 1, lastDay - daysNeeded);
  const landings: LineFlight[] = [];
  for (let day = firstDay; day <= lastDay; day++) {
    for (const flight of lineDay(line, aircraftId, day)) {
      if (flight.arrivalTick > fromTick && flight.arrivalTick <= toTick) landings.push(flight);
    }
  }
  return landings.slice(-max);
}

/** The line's departures in (fromTick, toTick], oldest first, at most `max` (the newest kept). */
export function lineDeparturesBetween(
  line: LineOfFlying,
  aircraftId: string,
  fromTick: number,
  toTick: number,
  max = 200,
): LineFlight[] {
  if (toTick <= fromTick || line.legs.length === 0) return [];
  const daysNeeded = Math.ceil(max / line.legs.length) + 2;
  const lastDay = utcDayOf(toTick);
  const firstDay = Math.max(utcDayOf(fromTick) - 1, lastDay - daysNeeded);
  const departures: LineFlight[] = [];
  for (let day = firstDay; day <= lastDay; day++) {
    for (const flight of lineDay(line, aircraftId, day)) {
      if (flight.departureTick > fromTick && flight.departureTick <= toTick)
        departures.push(flight);
    }
  }
  return departures.slice(-max);
}

/**
 * How many landings each leg makes in (fromTick, toTick], for any span in
 * O(legs): the two edge days are flown exactly, whole days in between land
 * every leg once.
 */
export function lineLandingCount(
  line: LineOfFlying,
  aircraftId: string,
  fromTick: number,
  toTick: number,
): number[] {
  const counts = new Array(line.legs.length).fill(0);
  if (toTick <= fromTick || line.legs.length === 0) return counts;
  const fromDay = utcDayOf(fromTick) - 1;
  const toDay = utcDayOf(toTick);
  const edge = (day: number) => {
    for (const flight of lineDay(line, aircraftId, day)) {
      if (flight.arrivalTick > fromTick && flight.arrivalTick <= toTick) {
        counts[flight.legIndex] += 1;
      }
    }
  };
  if (toDay - fromDay <= 4) {
    for (let day = fromDay; day <= toDay; day++) edge(day);
    return counts;
  }
  for (const day of [fromDay, fromDay + 1, toDay - 1, toDay]) edge(day);
  const first = Math.max(fromDay + 2, firstLineDay(line));
  const whole = Math.max(0, toDay - 2 - first + 1);
  for (let i = 0; i < counts.length; i++) counts[i] += whole;
  return counts;
}
