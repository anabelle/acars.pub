import { utcDayOf, utcDayStartTick } from "./line.js";
import type { FlightOffer, Route, RouteChange } from "./types.js";
import { TICKS_PER_HOUR } from "./types.js";

/**
 * Published timetables (S69, D12): fares and frequency on a route that is
 * already on sale change at 00:00 UTC the next day, like a real airline's
 * published schedule. Being online at 3 a.m. stops paying, and rivals see
 * the announced change in time to answer. Pure and deterministic.
 */

/** A frequency rise this soon after a plane joins the route flies at once (new capacity). */
export const JOIN_GRACE_TICKS = TICKS_PER_HOUR;

/** The fields a timetable change can carry. */
export type RouteChangeFields = Omit<RouteChange, "effectiveTick">;

const FIELDS = ["fareEconomy", "fareBusiness", "fareFirst", "frequencyPerWeek"] as const;

type Timetabled = Pick<
  Route,
  "fareEconomy" | "fareBusiness" | "fareFirst" | "frequencyPerWeek" | "pending" | "openedAtTick"
>;

/** The tick of the next 00:00 UTC after `tick`. */
export function nextUtcDayStartTick(tick: number): number {
  return utcDayStartTick(utcDayOf(tick) + 1);
}

/** On sale: opened before today (UTC). Routes from before S32 have no open tick and count as on sale. */
export function isPublished(route: Pick<Route, "openedAtTick">, tick: number): boolean {
  return route.openedAtTick === undefined || route.openedAtTick < utcDayStartTick(utcDayOf(tick));
}

function withChange<T extends object>(base: T, change: RouteChangeFields): T {
  const next = { ...base } as T & RouteChangeFields;
  for (const field of FIELDS) {
    const value = change[field];
    if (value !== undefined) (next as Record<string, unknown>)[field] = value;
  }
  return next;
}

/** The route as it is in force at `tick`: an announced change applies once its tick comes. */
export function routeAt<T extends Pick<Route, "pending">>(route: T, tick: number): T {
  const pending = route.pending;
  if (!pending || tick < pending.effectiveTick) return route;
  const rest = { ...route };
  delete rest.pending;
  return withChange(rest as T, pending);
}

/** A rival's offer as it is in force at `tick`. */
export function offerAt(offer: FlightOffer, tick: number): FlightOffer {
  const next = offer.next;
  if (!next || tick < next.effectiveTick) return offer;
  const rest = { ...offer };
  delete rest.next;
  return withChange(rest, next);
}

export type ChangeTiming =
  | { when: "now"; reason: "unpublished" | "newCapacity" }
  | { when: "tomorrow"; effectiveTick: number };

/**
 * When a change takes effect: now on a route opened today, now for a
 * frequency rise right after a plane joined (`lastJoinTick`), otherwise at
 * the next 00:00 UTC.
 */
export function scheduleChangeTiming(
  route: Timetabled,
  change: RouteChangeFields,
  tick: number,
  lastJoinTick?: number,
): ChangeTiming {
  if (!isPublished(route, tick)) return { when: "now", reason: "unpublished" };
  const current = routeAt(route, tick);
  const onlyFrequency =
    change.frequencyPerWeek !== undefined &&
    change.fareEconomy === undefined &&
    change.fareBusiness === undefined &&
    change.fareFirst === undefined;
  if (
    onlyFrequency &&
    (change.frequencyPerWeek ?? 0) > (current.frequencyPerWeek ?? 0) &&
    lastJoinTick !== undefined &&
    lastJoinTick <= tick &&
    tick - lastJoinTick <= JOIN_GRACE_TICKS
  ) {
    return { when: "now", reason: "newCapacity" };
  }
  return { when: "tomorrow", effectiveTick: nextUtcDayStartTick(tick) };
}

/**
 * Apply a timetable change made at `tick`: in force now, or merged into the
 * route's announced change for tomorrow. Fields set back to today's value
 * leave the announcement; an empty announcement is dropped.
 */
export function applyRouteChange<T extends Timetabled>(
  route: T,
  change: RouteChangeFields,
  tick: number,
  lastJoinTick?: number,
): T {
  const current = routeAt(route, tick);
  const timing = scheduleChangeTiming(current, change, tick, lastJoinTick);
  if (timing.when === "now") {
    const applied = withChange(current, change);
    if (!applied.pending) return applied;
    const pending: RouteChange = { ...applied.pending };
    for (const field of FIELDS) if (change[field] !== undefined) delete pending[field];
    return withPending(applied, pending);
  }
  return withPending(current, {
    ...current.pending,
    ...definedFields(change),
    effectiveTick: timing.effectiveTick,
  });
}

function definedFields(change: RouteChangeFields): RouteChangeFields {
  const out: RouteChangeFields = {};
  for (const field of FIELDS) {
    const value = change[field];
    if (value !== undefined) (out as unknown as Record<string, unknown>)[field] = value;
  }
  return out;
}

function withPending<T extends Timetabled>(route: T, pending: RouteChange): T {
  const kept: RouteChange = { effectiveTick: pending.effectiveTick };
  let any = false;
  for (const field of FIELDS) {
    const value = pending[field];
    if (value !== undefined && value !== route[field]) {
      (kept as unknown as Record<string, unknown>)[field] = value;
      any = true;
    }
  }
  const rest = { ...route };
  delete rest.pending;
  return (any ? { ...rest, pending: kept } : rest) as T;
}
