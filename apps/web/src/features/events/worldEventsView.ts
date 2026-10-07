import {
  getActiveEvents,
  getUpcomingEvents,
  TICKS_PER_HOUR,
  type WorldEvent,
  type WorldEventKind,
} from "@acars/core";

/** How far ahead "coming up" looks. */
export const UPCOMING_WINDOW_TICKS = 24 * TICKS_PER_HOUR;

export interface WorldEventView {
  event: WorldEvent;
  /** The player's routes this event touches ("MAD–BCN"); fuel spikes touch them all. */
  yourRoutes: string[];
  /** Effects as whole percentages (+30, -20); 0 when the event doesn't change it. */
  demandPct: number;
  feesPct: number;
  fuelPct: number;
  /** Active: ticks until it ends. Upcoming: ticks until it starts. */
  ticksLeft: number;
}

export interface WorldEventsBoard {
  active: WorldEventView[];
  upcoming: WorldEventView[];
}

type RouteEnds = { originIata: string; destinationIata: string };

const pct = (multiplier: number) => Math.round((multiplier - 1) * 100);

function view(event: WorldEvent, routes: readonly RouteEnds[], ticksLeft: number): WorldEventView {
  const yourRoutes = routes
    .filter(
      (route) =>
        event.airportIata === null ||
        route.originIata === event.airportIata ||
        route.destinationIata === event.airportIata,
    )
    .map((route) => `${route.originIata}–${route.destinationIata}`);
  return {
    event,
    yourRoutes,
    demandPct: pct(event.demandMultiplier),
    feesPct: pct(event.feesMultiplier),
    fuelPct: pct(event.fuelMultiplier),
    ticksLeft,
  };
}

/** Events touching the player first, then the soonest to end / start. */
const byRelevance = (a: WorldEventView, b: WorldEventView) =>
  Number(b.yourRoutes.length > 0) - Number(a.yourRoutes.length > 0) || a.ticksLeft - b.ticksLeft;

/**
 * What's happening in the world at `tick`, and what starts within a day, as
 * the cockpit card and the ticker show it. Pure.
 */
export function worldEventsBoard(tick: number, routes: readonly RouteEnds[]): WorldEventsBoard {
  return {
    active: getActiveEvents(tick)
      .map((event) => view(event, routes, event.endTick - tick))
      .sort(byRelevance),
    upcoming: getUpcomingEvents(tick, UPCOMING_WINDOW_TICKS)
      .map((event) => view(event, routes, event.startTick - tick))
      .sort(byRelevance),
  };
}

export interface WorldEventPin {
  id: string;
  kind: WorldEventKind;
  iata: string;
  longitude: number;
  latitude: number;
}

/**
 * Map pin data for active airport events (global events have no place).
 * Ready for a map layer (S43 follow-up); airports missing from the catalog
 * are skipped.
 */
export function worldEventPins(
  events: readonly WorldEvent[],
  lookup: (iata: string) => { longitude: number; latitude: number } | undefined,
): WorldEventPin[] {
  const pins: WorldEventPin[] = [];
  for (const event of events) {
    if (!event.airportIata) continue;
    const airport = lookup(event.airportIata);
    if (!airport) continue;
    pins.push({
      id: event.id,
      kind: event.kind,
      iata: event.airportIata,
      longitude: airport.longitude,
      latitude: airport.latitude,
    });
  }
  return pins;
}

/** "18h" / "45m" for countdowns. */
export function formatEventHours(ticks: number): string {
  const minutes = Math.max(0, Math.round(ticks / (TICKS_PER_HOUR / 60)));
  return minutes >= 60 ? `${Math.round(minutes / 60)}h` : `${minutes}m`;
}
