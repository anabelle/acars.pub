/**
 * World events (S33): festivals, sports finals, strikes, congested hubs and
 * fuel spikes that make the world move and create "act now" moments.
 *
 * The schedule is a pure function of the tick: each engine day draws one or
 * two events from a PRNG seeded with the day, so every client sees the same
 * events at the same time without any network traffic. Targets come from a
 * fixed list of well-known airports (the full catalog loads asynchronously
 * and core stays dependency-free).
 *
 * Effects are bounded: whatever overlaps, a route's demand stays within
 * [MIN_EVENT_DEMAND, MAX_EVENT_DEMAND] of normal, fees and fuel within their
 * own caps.
 */

import { createPRNG } from "./prng.js";
import { TICK_DURATION, TICKS_PER_DAY, TICKS_PER_HOUR } from "./types.js";

export type WorldEventKind = "festival" | "sportsFinal" | "strike" | "hubCongestion" | "fuelSpike";

export interface WorldEvent {
  /** `${day}:${index}`, unique and stable. */
  id: string;
  kind: WorldEventKind;
  /** The affected airport, or null for a global event (fuel spike). */
  airportIata: string | null;
  /** Active over [startTick, endTick). */
  startTick: number;
  endTick: number;
  /** Multiplies demand on routes touching the airport (1 = no change). */
  demandMultiplier: number;
  /** Multiplies airport fees for flights touching the airport. */
  feesMultiplier: number;
  /** Multiplies the fuel price (global events only). */
  fuelMultiplier: number;
}

interface EventTemplate {
  kind: WorldEventKind;
  /** Relative chance of being drawn. */
  weight: number;
  /** Duration range in hours, inclusive. */
  hours: [number, number];
  demandMultiplier: number;
  feesMultiplier: number;
  fuelMultiplier: number;
  /** Candidate airports; empty for global events. */
  airports: readonly string[];
}

/**
 * The catalog. Magnitudes are deliberately moderate: worth reacting to,
 * never enough to make or break an airline on their own.
 */
export const WORLD_EVENT_TEMPLATES: readonly EventTemplate[] = [
  {
    kind: "festival",
    weight: 3,
    hours: [24, 72],
    demandMultiplier: 1.3,
    feesMultiplier: 1,
    fuelMultiplier: 1,
    airports: ["GIG", "MUC", "MSY", "EDI", "BCN", "LAS", "AMS", "SYD", "BKK", "MEX", "NCE", "AUS"],
  },
  {
    kind: "sportsFinal",
    weight: 2,
    hours: [12, 36],
    demandMultiplier: 1.5,
    feesMultiplier: 1,
    fuelMultiplier: 1,
    airports: ["LHR", "MAD", "MIA", "LAX", "CDG", "DOH", "MEL", "MXP", "EZE", "JFK", "ORD", "GRU"],
  },
  {
    kind: "strike",
    weight: 2,
    hours: [12, 48],
    demandMultiplier: 0.7,
    feesMultiplier: 1.25,
    fuelMultiplier: 1,
    airports: ["CDG", "FRA", "LHR", "MAD", "FCO", "BRU", "LIS", "ATH", "AMS", "MXP"],
  },
  {
    kind: "hubCongestion",
    weight: 2,
    hours: [6, 24],
    demandMultiplier: 1,
    feesMultiplier: 1.4,
    fuelMultiplier: 1,
    airports: [
      "ATL",
      "ORD",
      "LHR",
      "DXB",
      "HND",
      "JFK",
      "CDG",
      "FRA",
      "AMS",
      "IST",
      "SIN",
      "LAX",
      "DFW",
      "PEK",
      "ICN",
    ],
  },
  {
    kind: "fuelSpike",
    weight: 1,
    hours: [24, 72],
    demandMultiplier: 1,
    feesMultiplier: 1,
    fuelMultiplier: 1.15,
    airports: [],
  },
];

/** Combined effect bounds, whatever overlaps. */
export const MIN_EVENT_DEMAND = 0.6;
export const MAX_EVENT_DEMAND = 1.6;
export const MAX_EVENT_FEES = 1.5;
export const MAX_EVENT_FUEL = 1.2;

/** The longest event, in days: how far back getActiveEvents must look. */
const MAX_EVENT_DAYS = Math.ceil(Math.max(...WORLD_EVENT_TEMPLATES.map((t) => t.hours[1])) / 24);
/** Mixed into the day seed so events don't share a stream with fuel or objectives. */
const WORLD_EVENT_SALT = 0x5eed_e7;
const TOTAL_WEIGHT = WORLD_EVENT_TEMPLATES.reduce((sum, t) => sum + t.weight, 0);

const dayCache = new Map<number, WorldEvent[]>();
const DAY_CACHE_MAX = 32;

/**
 * The events that start on engine day `day` (ticks [day·TICKS_PER_DAY, …)).
 * One or two per day; a second event never reuses the first one's kind or
 * airport. Pure and memoized.
 */
export function getEventsForDay(day: number): WorldEvent[] {
  if (day < 0) return [];
  const cached = dayCache.get(day);
  if (cached) return cached;

  const random = createPRNG((Math.imul(day + 1, 0x9e3779b1) ^ WORLD_EVENT_SALT) >>> 0);
  const count = random() < 0.4 ? 2 : 1;
  const events: WorldEvent[] = [];
  for (let index = 0; index < count; index++) {
    // Weighted kind, re-drawn (deterministically) if it repeats today's.
    let template = pickTemplate(random());
    for (let tries = 0; events.some((e) => e.kind === template.kind) && tries < 8; tries++) {
      template = pickTemplate(random());
    }
    if (events.some((e) => e.kind === template.kind)) break;

    let airportIata: string | null = null;
    if (template.airports.length > 0) {
      const taken = new Set(events.map((e) => e.airportIata));
      const free = template.airports.filter((iata) => !taken.has(iata));
      airportIata = free[Math.floor(random() * free.length)];
    }
    const startHour = Math.floor(random() * 24);
    const [minHours, maxHours] = template.hours;
    const hours = minHours + Math.floor(random() * (maxHours - minHours + 1));
    const startTick = day * TICKS_PER_DAY + startHour * TICKS_PER_HOUR;
    events.push({
      id: `${day}:${index}`,
      kind: template.kind,
      airportIata,
      startTick,
      endTick: startTick + hours * TICKS_PER_HOUR,
      demandMultiplier: template.demandMultiplier,
      feesMultiplier: template.feesMultiplier,
      fuelMultiplier: template.fuelMultiplier,
    });
  }

  if (dayCache.size >= DAY_CACHE_MAX) dayCache.clear();
  dayCache.set(day, events);
  return events;
}

function pickTemplate(roll: number): EventTemplate {
  let threshold = roll * TOTAL_WEIGHT;
  for (const template of WORLD_EVENT_TEMPLATES) {
    threshold -= template.weight;
    if (threshold < 0) return template;
  }
  return WORLD_EVENT_TEMPLATES[WORLD_EVENT_TEMPLATES.length - 1];
}

/**
 * Events active at `tick`. Looks back only as far as the longest event, so
 * the cost is constant whatever the tick.
 */
export function getActiveEvents(tick: number): WorldEvent[] {
  const day = Math.floor(tick / TICKS_PER_DAY);
  const active: WorldEvent[] = [];
  for (let d = day - MAX_EVENT_DAYS; d <= day; d++) {
    for (const event of getEventsForDay(d)) {
      if (tick >= event.startTick && tick < event.endTick) active.push(event);
    }
  }
  return active;
}

/** Events starting within the next `withinTicks` (for "coming up" hints). */
export function getUpcomingEvents(tick: number, withinTicks: number): WorldEvent[] {
  const firstDay = Math.floor(tick / TICKS_PER_DAY);
  const lastDay = Math.floor((tick + withinTicks) / TICKS_PER_DAY);
  const upcoming: WorldEvent[] = [];
  for (let d = firstDay; d <= lastDay; d++) {
    for (const event of getEventsForDay(d)) {
      if (event.startTick > tick && event.startTick <= tick + withinTicks) upcoming.push(event);
    }
  }
  return upcoming;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Demand multiplier for a route between two airports, from the active events. */
export function eventDemandMultiplier(
  events: readonly WorldEvent[],
  originIata: string,
  destinationIata: string,
): number {
  let multiplier = 1;
  for (const event of events) {
    if (event.airportIata === originIata || event.airportIata === destinationIata) {
      multiplier *= event.demandMultiplier;
    }
  }
  return clamp(multiplier, MIN_EVENT_DEMAND, MAX_EVENT_DEMAND);
}

/** Airport-fees multiplier for a flight between two airports. */
export function eventFeesMultiplier(
  events: readonly WorldEvent[],
  originIata: string,
  destinationIata: string,
): number {
  let multiplier = 1;
  for (const event of events) {
    if (event.airportIata === originIata || event.airportIata === destinationIata) {
      multiplier *= event.feesMultiplier;
    }
  }
  return clamp(multiplier, 1, MAX_EVENT_FEES);
}

/** Fuel-price multiplier from global events. */
export function eventFuelMultiplier(events: readonly WorldEvent[]): number {
  let multiplier = 1;
  for (const event of events) {
    if (event.airportIata === null) multiplier *= event.fuelMultiplier;
  }
  return clamp(multiplier, 1, MAX_EVENT_FUEL);
}

/** Milliseconds from `tick` until the event ends (for countdowns). */
export const eventRemainingMs = (event: WorldEvent, tick: number): number =>
  Math.max(0, event.endTick - tick) * TICK_DURATION;
