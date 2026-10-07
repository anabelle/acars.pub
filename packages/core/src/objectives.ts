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
import { createPRNG } from "./prng.js";
import { GENESIS_TIME, TICK_DURATION, type AirportTag, type FixedPoint } from "./types.js";

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
