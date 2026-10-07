/**
 * Daily objectives (S32; decision D6: replay-verified claims). Every UTC day
 * has the same three objectives for every player, picked by a PRNG seeded
 * with the day, so any client derives them independently.
 *
 * Objectives are about the player's own actions (open a route, retune fares,
 * service an aircraft…), because those are durable, ordered events in every
 * replay. Engine results such as passengers carried only reach a replay
 * through replaceable TICK_UPDATE payloads, so a claim on them could verify
 * on one client and not on another; they wait for durable daily summaries.
 */

import { fp } from "./fixed-point.js";
import { haversineDistance } from "./geo.js";
import { createPRNG } from "./prng.js";
import {
  type Airport,
  type AirportTag,
  type FixedPoint,
  GENESIS_TIME,
  TICK_DURATION,
} from "./types.js";

export type ObjectiveKind =
  | "openRoute"
  | "openRouteToTag"
  | "acquireAircraft"
  | "assignAircraft"
  | "tuneFares"
  | "adjustSchedule"
  | "serviceAircraft";

export interface DailyObjective {
  /** `${date}:${kind}`, unique per day (kinds don't repeat within a day). */
  id: string;
  /** UTC calendar date, YYYY-MM-DD. */
  date: string;
  kind: ObjectiveKind;
  /** How many qualifying actions complete it. */
  target: number;
  /** openRoute: the route must be at least this long (0 = any route). */
  minDistanceKm?: number;
  /** openRouteToTag: the destination must carry this tag. */
  tag?: Exclude<AirportTag, "general">;
  /** Cash credited once when claimed. */
  reward: FixedPoint;
}

export const DAILY_OBJECTIVE_COUNT = 3;

interface Template {
  kind: ObjectiveKind;
  /** Parameter variants; the day's PRNG picks one. */
  variants: Array<Omit<DailyObjective, "id" | "date" | "kind">>;
}

/**
 * The template table. Rewards are deliberately small next to a starting
 * balance: a reason to check in, not an income source. Actions that cost
 * money (a route's slot fee, an aircraft) pay more than free ones.
 */
export const OBJECTIVE_TEMPLATES: readonly Template[] = [
  {
    kind: "openRoute",
    variants: [
      { target: 1, minDistanceKm: 0, reward: fp(120_000) },
      { target: 1, minDistanceKm: 1_000, reward: fp(150_000) },
      { target: 1, minDistanceKm: 3_000, reward: fp(200_000) },
    ],
  },
  {
    kind: "openRouteToTag",
    variants: [
      { target: 1, tag: "beach", reward: fp(150_000) },
      { target: 1, tag: "ski", reward: fp(150_000) },
      { target: 1, tag: "business", reward: fp(150_000) },
    ],
  },
  { kind: "acquireAircraft", variants: [{ target: 1, reward: fp(100_000) }] },
  {
    kind: "assignAircraft",
    variants: [
      { target: 1, reward: fp(50_000) },
      { target: 2, reward: fp(90_000) },
    ],
  },
  { kind: "tuneFares", variants: [{ target: 1, reward: fp(25_000) }] },
  { kind: "adjustSchedule", variants: [{ target: 1, reward: fp(25_000) }] },
  {
    kind: "serviceAircraft",
    variants: [
      { target: 1, reward: fp(40_000) },
      { target: 2, reward: fp(70_000) },
    ],
  },
];

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
/** Mixed into the day seed so objectives don't share a stream with other day-seeded features. */
const OBJECTIVE_SALT = 0x0b1ec7;

/** Milliseconds since the epoch at UTC midnight of `date`, or null if invalid. */
function utcMidnight(date: string): number | null {
  const match = DATE_PATTERN.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  // Reject impossible dates like 2026-02-30 instead of rolling them over.
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

/** UTC calendar date (YYYY-MM-DD) of an engine tick. */
export function utcDateForTick(tick: number): string {
  return new Date(GENESIS_TIME + tick * TICK_DURATION).toISOString().slice(0, 10);
}

/**
 * Engine ticks covered by `date`: [startTick, endTick). Exact integers,
 * since a UTC day and the genesis offset are whole multiples of a tick.
 */
export function objectiveDayWindow(date: string): { startTick: number; endTick: number } {
  const midnight = utcMidnight(date);
  if (midnight === null) throw new Error(`Invalid objective date: ${date}`);
  const startTick = (midnight - GENESIS_TIME) / TICK_DURATION;
  return { startTick, endTick: startTick + DAY_MS / TICK_DURATION };
}

/**
 * The day's objectives: three different kinds, each with one of its
 * variants, chosen by a PRNG seeded with the day number. Pure and identical
 * on every client for the same date.
 */
export function getDailyObjectives(date: string): DailyObjective[] {
  const midnight = utcMidnight(date);
  if (midnight === null) throw new Error(`Invalid objective date: ${date}`);
  const dayNumber = midnight / DAY_MS;
  const random = createPRNG((Math.imul(dayNumber, 0x9e3779b1) ^ OBJECTIVE_SALT) >>> 0);

  // Fisher–Yates over the template indices, then take the first three.
  const order = OBJECTIVE_TEMPLATES.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return order.slice(0, DAILY_OBJECTIVE_COUNT).map((index) => {
    const template = OBJECTIVE_TEMPLATES[index];
    const variant = template.variants[Math.floor(random() * template.variants.length)];
    return { id: `${date}:${template.kind}`, date, kind: template.kind, ...variant };
  });
}

// --- Progress ---

/**
 * A player action the replay accepted, reduced to what objectives need.
 * The action reducer records these only when the action actually changed
 * state (a route really opened, a fare really moved), so a rejected or
 * no-op event never counts.
 */
export type ObjectiveActivity =
  | {
      type: "routeOpened";
      tick: number;
      routeId: string;
      originIata: string;
      destinationIata: string;
    }
  | { type: "aircraftAcquired"; tick: number; aircraftId: string }
  | { type: "aircraftAssigned"; tick: number; aircraftId: string; routeId: string }
  | { type: "faresUpdated"; tick: number; routeId: string }
  | { type: "frequencyUpdated"; tick: number; routeId: string }
  | { type: "aircraftServiced"; tick: number; aircraftId: string };

/** Catalog access for route objectives (distance and destination tags). */
export type ObjectiveAirportLookup = (
  iata: string,
) => Pick<Airport, "latitude" | "longitude" | "tags"> | undefined;

export interface ObjectiveProgress {
  objective: DailyObjective;
  /** Qualifying actions so far, capped at the target. */
  progress: number;
  complete: boolean;
}

/**
 * Whether a route opening qualifies. Distance comes from the catalog, never
 * from the event's declared distance, so a padded payload can't pass a
 * long-haul objective; airports missing from the catalog never qualify.
 */
function routeQualifies(
  objective: DailyObjective,
  activity: Extract<ObjectiveActivity, { type: "routeOpened" }>,
  lookup: ObjectiveAirportLookup,
): boolean {
  const origin = lookup(activity.originIata);
  const destination = lookup(activity.destinationIata);
  if (!origin || !destination) return false;
  if (objective.kind === "openRouteToTag") {
    return objective.tag !== undefined && destination.tags.includes(objective.tag);
  }
  const minKm = objective.minDistanceKm ?? 0;
  if (minKm <= 0) return true;
  return (
    haversineDistance(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    ) >= minKm
  );
}

/**
 * Progress on one objective from the activities inside its UTC day. Counts
 * distinct subjects (routes or aircraft), so repeating the same action on
 * the same aircraft doesn't fill a "2 aircraft" objective. Linear in the
 * activities given; the reducer keeps only the last two days of them.
 */
export function evaluateObjective(
  objective: DailyObjective,
  activities: readonly ObjectiveActivity[],
  lookup: ObjectiveAirportLookup,
): ObjectiveProgress {
  const { startTick, endTick } = objectiveDayWindow(objective.date);
  const subjects = new Set<string>();
  for (const activity of activities) {
    if (activity.tick < startTick || activity.tick >= endTick) continue;
    switch (objective.kind) {
      case "openRoute":
      case "openRouteToTag":
        if (activity.type === "routeOpened" && routeQualifies(objective, activity, lookup)) {
          subjects.add(activity.routeId);
        }
        break;
      case "acquireAircraft":
        if (activity.type === "aircraftAcquired") subjects.add(activity.aircraftId);
        break;
      case "assignAircraft":
        if (activity.type === "aircraftAssigned") subjects.add(activity.aircraftId);
        break;
      case "tuneFares":
        if (activity.type === "faresUpdated") subjects.add(activity.routeId);
        break;
      case "adjustSchedule":
        if (activity.type === "frequencyUpdated") subjects.add(activity.routeId);
        break;
      case "serviceAircraft":
        if (activity.type === "aircraftServiced") subjects.add(activity.aircraftId);
        break;
    }
  }
  const progress = Math.min(subjects.size, objective.target);
  return { objective, progress, complete: progress >= objective.target };
}

/** Progress on all of `date`'s objectives. */
export function evaluateDailyObjectives(
  date: string,
  activities: readonly ObjectiveActivity[],
  lookup: ObjectiveAirportLookup,
): ObjectiveProgress[] {
  return getDailyObjectives(date).map((objective) =>
    evaluateObjective(objective, activities, lookup),
  );
}

// --- Ledger (carried through replays and checkpoints) ---

/**
 * What a replay remembers for objectives: recent qualifying activity and
 * the objective ids already claimed. Bounded: only the current and the
 * previous UTC day are kept (a claim for yesterday stays possible just
 * after midnight), so it never grows with the length of the log.
 */
export interface ObjectiveLedger {
  activity: ObjectiveActivity[];
  /** Claimed objective ids (`${date}:${kind}`). */
  claimed: string[];
}

export const emptyObjectiveLedger = (): ObjectiveLedger => ({ activity: [], claimed: [] });

/** First tick worth keeping when the newest action is at `tick`: yesterday's UTC midnight. */
export function objectiveRetentionStart(tick: number): number {
  return objectiveDayWindow(utcDateForTick(tick)).startTick - DAY_MS / TICK_DURATION;
}

/** Drops ledger entries older than the retention window ending at `tick`. */
export function pruneObjectiveLedger(ledger: ObjectiveLedger, tick: number): ObjectiveLedger {
  const keepFrom = objectiveRetentionStart(tick);
  const keepFromDate = utcDateForTick(keepFrom);
  return {
    activity: ledger.activity.filter((entry) => entry.tick >= keepFrom),
    // ISO dates compare correctly as strings.
    claimed: ledger.claimed.filter((id) => id.slice(0, 10) >= keepFromDate),
  };
}
