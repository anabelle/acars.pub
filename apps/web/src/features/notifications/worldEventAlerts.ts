import type { Route, WorldEvent } from "@acars/core";
import { getUpcomingEvents, TICKS_PER_HOUR } from "@acars/core";

/**
 * "An event just started on one of your routes" (S55.4): which world events
 * began between two engine ticks at an airport the player flies to or from.
 * Pure; the notification bridge decides when to show them.
 */

/** Only events that started this recently notify: after a long absence the
 * away report tells the story, and a stale "just started" would be wrong. */
export const WORLD_EVENT_ALERT_WINDOW_TICKS = TICKS_PER_HOUR;

export interface WorldEventAlert {
  event: WorldEvent;
  /** The player's active routes touching the event's airport, "MAD–BCN". */
  routes: string[];
}

/**
 * Events starting in (fromTick, toTick] (at most the last hour) at an
 * airport on one of the player's active routes. O(days × events + routes).
 */
export function worldEventsStartingOnRoutes(
  fromTick: number,
  toTick: number,
  routes: readonly Pick<Route, "originIata" | "destinationIata" | "status">[],
): WorldEventAlert[] {
  const from = Math.max(fromTick, toTick - WORLD_EVENT_ALERT_WINDOW_TICKS);
  if (toTick <= from) return [];
  const alerts: WorldEventAlert[] = [];
  for (const event of getUpcomingEvents(from, toTick - from)) {
    if (event.airportIata === null) continue;
    const touching = routes
      .filter(
        (route) =>
          route.status === "active" &&
          (route.originIata === event.airportIata || route.destinationIata === event.airportIata),
      )
      .map((route) => `${route.originIata}–${route.destinationIata}`);
    if (touching.length > 0) alerts.push({ event, routes: touching });
  }
  return alerts;
}
