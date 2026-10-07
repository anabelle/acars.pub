import { type Route, TICKS_PER_DAY } from "@acars/core";

/** Days without any activity after which a routeless airline leaves the shared world (S26). */
export const ABANDONED_AFTER_DAYS = 7;

/**
 * Whether a rival airline is abandoned: it flies no active route and hasn't
 * acted for ABANDONED_AFTER_DAYS. Mostly guests who tried the game for a
 * minute. They have no market effect, so hiding them from the world map,
 * rival lists and leaderboard changes nothing but the clutter. They stay on
 * relays and reappear as soon as they act again. Pure.
 */
export function isAbandonedAirline(
  routes: readonly Pick<Route, "status">[],
  lastActiveTick: number | null | undefined,
  currentTick: number,
): boolean {
  if (routes.some((route) => route.status === "active")) return false;
  if (lastActiveTick == null) return false;
  return currentTick - lastActiveTick > ABANDONED_AFTER_DAYS * TICKS_PER_DAY;
}
