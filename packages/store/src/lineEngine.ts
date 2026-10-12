import type {
  AircraftInstance,
  AircraftModel,
  FixedPoint,
  FlightOffer,
  LineError,
  LineFlight,
  LineLeg,
  Route,
  TimelineEvent,
} from "@acars/core";
import {
  canonicalRouteKey,
  fp,
  fpAdd,
  fpFormat,
  fpScale,
  GENESIS_TIME,
  isGrounded,
  legTicksFor,
  lineDeparturesBetween,
  lineLandingCount,
  lineLandingsBetween,
  linePhaseAt,
  TICK_DURATION,
  TICKS_PER_HOUR,
  validateLine,
  type WeatherLookup,
} from "@acars/core";
import { type ConnectionService, legKey } from "./connections.js";
import {
  computeLandingEconomics,
  estimateLandingFinancials,
  type FlightEngineHubState,
  type LineService,
} from "./FlightEngine.js";

/** One leg as a player asks for it: which route, which way, when it leaves (ticks after 00:00 UTC). */
export interface LineLegRequest {
  routeId: string;
  direction: "outbound" | "inbound";
  departOffsetTicks: number;
}

export type LineBuildError = LineError | "unknown-route" | "inactive-route" | "out-of-range";

/**
 * Turns a requested line into flyable legs for this plane (S66): each
 * route's direction gives origin and destination, the plane's model gives
 * block time and turnaround. The reducer and the optimistic store both use
 * this, so they agree.
 */
export function buildLineLegs(
  requests: readonly LineLegRequest[],
  routeById: ReadonlyMap<string, Route>,
  model: Pick<AircraftModel, "speedKmh" | "turnaroundTimeMinutes" | "rangeKm">,
): { legs: LineLeg[]; error: null } | { legs: null; error: LineBuildError } {
  const legs: LineLeg[] = [];
  for (const request of requests) {
    const route = routeById.get(request.routeId);
    if (!route) return { legs: null, error: "unknown-route" };
    if (route.status !== "active") return { legs: null, error: "inactive-route" };
    if (route.distanceKm > (model.rangeKm || 0)) return { legs: null, error: "out-of-range" };
    const outbound = request.direction !== "inbound";
    const timing = legTicksFor(route.distanceKm, model.speedKmh, model.turnaroundTimeMinutes);
    legs.push({
      routeId: route.id,
      originIata: outbound ? route.originIata : route.destinationIata,
      destinationIata: outbound ? route.destinationIata : route.originIata,
      departOffsetTicks: Math.round(request.departOffsetTicks),
      durationTicks: timing.durationTicks,
      turnaroundTicks: timing.turnaroundTicks,
    });
  }
  const error = validateLine(legs);
  return error ? { legs: null, error } : { legs, error: null };
}

/** "MAD→BCN→LIS→MAD": the airports a line visits, in order. */
export function describeLine(
  legs: readonly Pick<LineLeg, "originIata" | "destinationIata">[],
): string {
  if (legs.length === 0) return "";
  return [legs[0].originIata, ...legs.map((leg) => leg.destinationIata)].join("→");
}

/** Sanitizes a payload's legs (Nostr input): at most 12, known shapes only. */
export function parseLineLegRequests(value: unknown): LineLegRequest[] | null {
  if (!Array.isArray(value) || value.length > 12) return null;
  const legs: LineLegRequest[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const { routeId, direction, departOffsetTicks } = item as Record<string, unknown>;
    if (typeof routeId !== "string" || routeId.length === 0 || routeId.length > 64) return null;
    if (direction !== "outbound" && direction !== "inbound") return null;
    if (typeof departOffsetTicks !== "number" || !Number.isFinite(departOffsetTicks)) return null;
    legs.push({ routeId, direction, departOffsetTicks: Math.round(departOffsetTicks) });
  }
  return legs;
}

/** The engine context a live landing needs (the same as a route cycle's). */
export interface LineEngineContext {
  routeById: ReadonlyMap<string, Route>;
  airportTraffic: ReadonlyMap<string, number>;
  hubStates: ReadonlyMap<string, FlightEngineHubState>;
  registry: ReadonlyMap<string, FlightOffer[]>;
  lineService: ReadonlyMap<string, LineService>;
  /** Connecting passengers per leg (S67); absent in catch-up estimates. */
  connections?: ConnectionService;
  /** Weather at airports (S68); calm when absent. */
  weather?: WeatherLookup;
  playerPubkey: string;
  playerBrandScore: number;
  distanceLimitKm: number;
}

export interface LineAdvance {
  events: TimelineEvent[];
  balanceDelta: FixedPoint;
  revenue: FixedPoint;
  changed: boolean;
}

const DEFAULT_LOAD_FACTOR = 0.65;
/** Landing events kept for a catch-up; the money still counts every landing. */
const MAX_CATCHUP_EVENTS = 200;
const ON_GROUND = new Set(["idle", "turnaround"]);

function flightState(flight: LineFlight, routeById: ReadonlyMap<string, Route>) {
  const route = routeById.get(flight.leg.routeId);
  return {
    originIata: flight.leg.originIata,
    destinationIata: flight.leg.destinationIata,
    departureTick: flight.departureTick,
    arrivalTick: flight.arrivalTick,
    direction:
      route && route.originIata !== flight.leg.originIata
        ? ("inbound" as const)
        : ("outbound" as const),
    routeId: flight.leg.routeId,
  };
}

function wear(ac: AircraftInstance, hours: number, perHour: number): void {
  ac.flightHoursTotal += hours;
  ac.flightHoursSinceCheck += hours;
  ac.condition = Math.max(0, ac.condition - perHour * hours);
}

/**
 * Moves a plane on a line of flying from `fromTick` to `toTick` (S66): its
 * position comes straight from the line, and every landing in between is
 * paid — with the full demand model when `mode` is "live", estimated from
 * its last load factor when catching up. Mutates `ac` (a copy). A grounded
 * plane stays on the ground.
 */
export function advanceLineAircraft(
  ac: AircraftInstance,
  model: AircraftModel,
  fromTick: number,
  toTick: number,
  mode: "live" | "estimate",
  ctx: LineEngineContext,
  wearPerHour: number,
): LineAdvance {
  const line = ac.line;
  const result: LineAdvance = { events: [], balanceDelta: fp(0), revenue: fp(0), changed: false };
  if (!line || toTick <= fromTick || ac.status === "maintenance" || ac.status === "delivery") {
    return result;
  }
  if (isGrounded(ac) && ON_GROUND.has(ac.status)) return result;

  const maxEvents = mode === "live" ? 50 : MAX_CATCHUP_EVENTS;
  const landings = lineLandingsBetween(line, ac.id, fromTick, toTick, maxEvents, ctx.weather);

  // Takeoffs in the span (newest few), so boards and the ticker see them.
  const departed = lineDeparturesBetween(line, ac.id, fromTick, toTick, maxEvents, ctx.weather);
  for (const flight of departed) {
    result.events.push({
      id: `evt-takeoff-${ac.id}-${flight.departureTick}`,
      tick: flight.departureTick,
      timestamp: GENESIS_TIME + flight.departureTick * TICK_DURATION,
      type: "takeoff",
      aircraftId: ac.id,
      aircraftName: ac.name,
      routeId: flight.leg.routeId,
      originIata: flight.leg.originIata,
      destinationIata: flight.leg.destinationIata,
      description: `${ac.name} taking off: ${flight.leg.originIata} → ${flight.leg.destinationIata}`,
    });
  }

  let sampled = fp(0);
  for (const flight of landings) {
    const route = ctx.routeById.get(flight.leg.routeId) ?? null;
    const hours = Math.min(24, flight.leg.durationTicks / TICKS_PER_HOUR);
    ac.flight = flightState(flight, ctx.routeById);
    const timestamp = GENESIS_TIME + flight.arrivalTick * TICK_DURATION;
    let event: TimelineEvent;
    if (mode === "live" && route) {
      const outcome = computeLandingEconomics({
        ac,
        model,
        route,
        originIata: flight.leg.originIata,
        destinationIata: flight.leg.destinationIata,
        priced: true,
        tick: flight.arrivalTick,
        airportTraffic: ctx.airportTraffic,
        hubStates: ctx.hubStates,
        competitorOffers:
          ctx.registry.get(canonicalRouteKey(flight.leg.originIata, flight.leg.destinationIata)) ??
          [],
        playerPubkey: ctx.playerPubkey,
        playerBrandScore: ctx.playerBrandScore,
        distanceLimitKm: ctx.distanceLimitKm,
        lineService: ctx.lineService.get(route.id),
        connecting: ctx.connections?.byLeg.get(
          legKey(flight.leg.originIata, flight.leg.destinationIata),
        ),
      });
      const { rev, cost, profit, fareRatio } = outcome;
      result.revenue = fpAdd(result.revenue, rev.revenueTotal);
      result.balanceDelta = fpAdd(result.balanceDelta, profit);
      ac.lastKnownLoadFactor = rev.loadFactor;
      wear(ac, hours, wearPerHour);
      event = {
        id: `evt-landing-${ac.id}-${flight.arrivalTick}`,
        tick: flight.arrivalTick,
        timestamp,
        type: "landing",
        aircraftId: ac.id,
        aircraftName: ac.name,
        routeId: route.id,
        originIata: flight.leg.originIata,
        destinationIata: flight.leg.destinationIata,
        revenue: rev.revenueTotal,
        cost: cost.costTotal,
        profit,
        description: `${ac.name} landed at ${flight.leg.destinationIata}. Net profit ${profit > 0 ? "+" : ""}${fpFormat(profit, 0)}.`,
        details: {
          passengers: {
            economy: rev.actualEconomy,
            business: rev.actualBusiness,
            first: rev.actualFirst,
            total: rev.actualPassengers,
          },
          seatsOffered: rev.seatsOffered,
          loadFactor: rev.loadFactor,
          fareRatio,
          aircraftCondition: ac.condition,
          spilledPassengers: rev.spilledPassengers,
          connectingPassengers: outcome.connectingPassengers,
          routeId: route.id,
          flightDurationTicks: flight.leg.durationTicks,
          delayTicks: flight.delayTicks,
          weatherDelayTicks: flight.weatherTicks || undefined,
          revenue: {
            tickets: rev.revenueTicket,
            economy: rev.revenueEconomy,
            business: rev.revenueBusiness,
            first: rev.revenueFirst,
            ancillary: rev.revenueAncillary,
          },
          costs: {
            fuel: cost.costFuel,
            crew: cost.costCrew,
            maintenance: cost.costMaintenance,
            airport: cost.costAirport,
            navigation: cost.costNavigation,
            leasing: cost.costLeasing,
            handling: cost.costHandling,
            distribution: cost.costDistribution,
            overhead: cost.costOverhead,
          },
        },
      };
    } else if (route) {
      const financials = estimateLandingFinancials(
        ac,
        route,
        model,
        hours,
        ac.lastKnownLoadFactor ?? DEFAULT_LOAD_FACTOR,
        flight.arrivalTick,
      );
      sampled = fpAdd(sampled, financials.profit);
      result.balanceDelta = fpAdd(result.balanceDelta, financials.profit);
      wear(ac, hours, wearPerHour);
      event = {
        id: `evt-landing-${ac.id}-${flight.arrivalTick}`,
        tick: flight.arrivalTick,
        timestamp,
        type: "landing",
        aircraftId: ac.id,
        aircraftName: ac.name,
        routeId: route.id,
        originIata: flight.leg.originIata,
        destinationIata: flight.leg.destinationIata,
        description: `${ac.name} landed at ${flight.leg.destinationIata}`,
        revenue: financials.revenue.revenueTotal,
        cost: financials.cost.costTotal,
        profit: financials.profit,
        details: {
          ...financials.details,
          flightDurationTicks: flight.leg.durationTicks,
          delayTicks: flight.delayTicks,
          weatherDelayTicks: flight.weatherTicks || undefined,
        },
      };
    } else {
      continue; // the route was closed: the leg flies empty and is not paid
    }
    result.events.push(event);
  }

  // A long absence: landings beyond the events kept are paid at the average.
  if (mode === "estimate" && landings.length > 0) {
    const total = lineLandingCount(line, ac.id, fromTick, toTick, ctx.weather).reduce(
      (a, b) => a + b,
      0,
    );
    const extra = total - landings.length;
    if (extra > 0) {
      const average = fpScale(sampled, 1 / landings.length);
      result.balanceDelta = fpAdd(result.balanceDelta, fpScale(average, extra));
      const avgHours =
        line.legs.reduce((sum, leg) => sum + leg.durationTicks, 0) /
        line.legs.length /
        TICKS_PER_HOUR;
      wear(ac, extra * Math.min(24, avgHours), wearPerHour);
    }
  }

  // Where the plane is now, from the line.
  const phase = linePhaseAt(line, ac.id, toTick, ctx.weather);
  const before = `${ac.status}|${ac.baseAirportIata}|${ac.flight?.departureTick}`;
  ac.status = phase.status;
  if (phase.status === "enroute" && phase.flight) {
    ac.flight = flightState(phase.flight, ctx.routeById);
    ac.baseAirportIata = phase.flight.leg.originIata;
    ac.turnaroundEndTick = undefined;
    ac.arrivalTickProcessed = undefined;
  } else {
    ac.flight = phase.flight ? flightState(phase.flight, ctx.routeById) : null;
    ac.baseAirportIata = phase.airportIata;
    ac.turnaroundEndTick = phase.turnaroundEndTick ?? undefined;
    ac.arrivalTickProcessed = phase.flight?.arrivalTick;
  }
  result.changed =
    result.events.length > 0 ||
    before !== `${ac.status}|${ac.baseAirportIata}|${ac.flight?.departureTick}`;
  return result;
}

/**
 * The optimistic store update for a new line (S66), the same rules as the
 * replay's AIRCRAFT_LINE_SET: on the ground, starting where the plane is;
 * an empty request clears the line. Null when the line cannot be set.
 */
export function applyAircraftLine(
  fleet: readonly AircraftInstance[],
  routes: readonly Route[],
  aircraftId: string,
  requests: readonly LineLegRequest[],
  tick: number,
  model: Pick<AircraftModel, "speedKmh" | "turnaroundTimeMinutes" | "rangeKm">,
):
  | { fleet: AircraftInstance[]; routes: Route[] }
  | { error: LineBuildError | "flying" | "not-at-start" } {
  const aircraft = fleet.find((ac) => ac.id === aircraftId);
  if (!aircraft) return { error: "unknown-route" };
  if (aircraft.status === "enroute" && (aircraft.flight?.arrivalTick ?? 0) > tick) {
    return { error: "flying" };
  }
  let legs: LineLeg[] | null = null;
  if (requests.length > 0) {
    const built = buildLineLegs(requests, new Map(routes.map((r) => [r.id, r])), model);
    if (!built.legs) return { error: built.error };
    if (built.legs[0].originIata !== aircraft.baseAirportIata) return { error: "not-at-start" };
    legs = built.legs;
  }
  const lineRoutes = new Set(legs?.map((leg) => leg.routeId) ?? []);
  const grounded = aircraft.status === "delivery" || aircraft.status === "maintenance";
  const updated: AircraftInstance = {
    ...aircraft,
    line: legs ? { legs, startTick: tick } : null,
    assignedRouteId: legs ? null : aircraft.line ? null : aircraft.assignedRouteId,
    routeAssignedAtTick: legs ? undefined : aircraft.routeAssignedAtTick,
    routeAssignedAtIata: legs ? undefined : aircraft.routeAssignedAtIata,
    lastKnownLoadFactor: legs ? undefined : aircraft.lastKnownLoadFactor,
    ...(grounded
      ? {}
      : {
          status: "idle" as const,
          flight: null,
          turnaroundEndTick: undefined,
          arrivalTickProcessed: undefined,
        }),
  };
  const nextRoutes = routes.map((route) => {
    const listed = route.assignedAircraftIds.includes(aircraftId);
    const wanted =
      lineRoutes.has(route.id) ||
      (!legs && !aircraft.line && route.id === aircraft.assignedRouteId);
    if (listed === wanted) return route;
    return {
      ...route,
      assignedAircraftIds: wanted
        ? [...route.assignedAircraftIds, aircraftId]
        : route.assignedAircraftIds.filter((id) => id !== aircraftId),
    };
  });
  return { fleet: fleet.map((ac) => (ac.id === aircraftId ? updated : ac)), routes: nextRoutes };
}
