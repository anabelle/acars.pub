import type { AircraftModel, LineLeg, Route } from "@acars/core";
import { legTicksFor, TICKS_PER_DAY, TICKS_PER_HOUR } from "@acars/core";
import { buildLineLegs, type LineBuildError, type LineLegRequest } from "@acars/store";

const TICKS_PER_MINUTE = TICKS_PER_HOUR / 60;
/** Default slack between a plane being ready and its next departure. */
export const DEFAULT_BUFFER_TICKS = 30 * TICKS_PER_MINUTE;
/** First departure of an empty day plan: 06:00 UTC. */
export const DEFAULT_FIRST_DEPARTURE = 6 * TICKS_PER_HOUR;
/** Auto-fill keeps the day between 06:00 and 23:30 UTC. */
const LAST_ARRIVAL = 23.5 * TICKS_PER_HOUR;
const STEP = 5 * TICKS_PER_MINUTE;

type Model = Pick<AircraftModel, "speedKmh" | "turnaroundTimeMinutes" | "rangeKm">;

export interface LegOption {
  routeId: string;
  direction: "outbound" | "inbound";
  destinationIata: string;
  durationTicks: number;
}

/** Legs the plane can fly next from `airportIata`: the airline's active routes touching it, in range. */
export function nextLegOptions(
  airportIata: string,
  routes: readonly Route[],
  model: Model,
): LegOption[] {
  const options: LegOption[] = [];
  for (const route of routes) {
    if (route.status !== "active" || route.distanceKm > (model.rangeKm || 0)) continue;
    const { durationTicks } = legTicksFor(
      route.distanceKm,
      model.speedKmh,
      model.turnaroundTimeMinutes,
    );
    if (route.originIata === airportIata) {
      options.push({
        routeId: route.id,
        direction: "outbound",
        destinationIata: route.destinationIata,
        durationTicks,
      });
    } else if (route.destinationIata === airportIata) {
      options.push({
        routeId: route.id,
        direction: "inbound",
        destinationIata: route.originIata,
        durationTicks,
      });
    }
  }
  return options.sort((a, b) => a.destinationIata.localeCompare(b.destinationIata));
}

const roundUp = (ticks: number) => Math.ceil(ticks / STEP) * STEP;

/** When the next leg should leave: the previous one's ready time plus a buffer, on a 5-minute step. */
export function defaultDeparture(previous: LineLeg | undefined): number {
  if (!previous) return DEFAULT_FIRST_DEPARTURE;
  return roundUp(
    previous.departOffsetTicks +
      previous.durationTicks +
      previous.turnaroundTicks +
      DEFAULT_BUFFER_TICKS,
  );
}

export interface LinePlan {
  /** Legs with this plane's timings, even when the plan is not valid yet. */
  legs: LineLeg[];
  error: LineBuildError | "not-at-start" | null;
  /** Slack before each leg after the first (ticks), then the overnight slack. */
  buffers: number[];
  blockTicks: number;
}

/**
 * A draft line checked exactly as the replay will check it (S66): the
 * plane's timings per leg, the first error, buffers and block time.
 */
export function planLine(
  draft: readonly LineLegRequest[],
  routes: readonly Route[],
  model: Model,
  startIata: string,
): LinePlan {
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const legs: LineLeg[] = [];
  for (const request of draft) {
    const route = routeById.get(request.routeId);
    if (!route) continue;
    const outbound = request.direction === "outbound";
    const timing = legTicksFor(route.distanceKm, model.speedKmh, model.turnaroundTimeMinutes);
    legs.push({
      routeId: route.id,
      originIata: outbound ? route.originIata : route.destinationIata,
      destinationIata: outbound ? route.destinationIata : route.originIata,
      departOffsetTicks: request.departOffsetTicks,
      ...timing,
    });
  }
  const built = buildLineLegs(draft, routeById, model);
  const error =
    built.error ?? (legs.length > 0 && legs[0].originIata !== startIata ? "not-at-start" : null);
  const buffers: number[] = [];
  for (let i = 1; i <= legs.length && legs.length > 0; i++) {
    const prev = legs[i - 1];
    const nextDeparture =
      i < legs.length ? legs[i].departOffsetTicks : legs[0].departOffsetTicks + TICKS_PER_DAY;
    buffers.push(
      nextDeparture - (prev.departOffsetTicks + prev.durationTicks + prev.turnaroundTicks),
    );
  }
  return {
    legs,
    error,
    buffers,
    blockTicks: legs.reduce((sum, leg) => sum + leg.durationTicks, 0),
  };
}

/**
 * A day plan for casual players (S66): out-and-back trips from the plane's
 * base, taking its routes in turn (shortest first), each leg leaving a
 * buffer after the plane is ready, while the day ends by 23:30 UTC.
 * Always closed (every trip returns home). Pure.
 */
export function autoFillLine(
  baseIata: string,
  routes: readonly Route[],
  model: Model,
): LineLegRequest[] {
  const trips = nextLegOptions(baseIata, routes, model).sort(
    (a, b) => a.durationTicks - b.durationTicks || a.routeId.localeCompare(b.routeId),
  );
  if (trips.length === 0) return [];
  const turnaround = legTicksFor(0, model.speedKmh, model.turnaroundTimeMinutes).turnaroundTicks;
  const plan: LineLegRequest[] = [];
  let clock = DEFAULT_FIRST_DEPARTURE;
  for (let i = 0; i < 24; i++) {
    const trip = trips[i % trips.length];
    const out = clock;
    const back = roundUp(out + trip.durationTicks + turnaround + DEFAULT_BUFFER_TICKS);
    const home = back + trip.durationTicks;
    if (home > LAST_ARRIVAL) break;
    plan.push(
      { routeId: trip.routeId, direction: trip.direction, departOffsetTicks: out },
      {
        routeId: trip.routeId,
        direction: trip.direction === "outbound" ? "inbound" : "outbound",
        departOffsetTicks: back,
      },
    );
    clock = roundUp(home + turnaround + DEFAULT_BUFFER_TICKS);
  }
  return plan;
}

/** "07:05" for a within-day offset. */
export function formatOffset(ticks: number): string {
  const minutes = Math.round(
    (((ticks % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY) / TICKS_PER_MINUTE,
  );
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Whether a plane is put to work: a single route or a line of flying (S66). */
export function isWorking(aircraft: {
  assignedRouteId: string | null;
  line?: { legs: unknown[] } | null;
}): boolean {
  return Boolean(aircraft.assignedRouteId) || Boolean(aircraft.line?.legs.length);
}

/** An existing line back into editable requests (direction from each route's orientation). */
export function draftFromLine(
  legs: readonly Pick<LineLeg, "routeId" | "originIata" | "departOffsetTicks">[],
  routes: readonly Pick<Route, "id" | "originIata">[],
): LineLegRequest[] {
  const routeById = new Map(routes.map((route) => [route.id, route]));
  return legs.map((leg) => ({
    routeId: leg.routeId,
    direction: routeById.get(leg.routeId)?.originIata === leg.originIata ? "outbound" : "inbound",
    departOffsetTicks: leg.departOffsetTicks,
  }));
}
