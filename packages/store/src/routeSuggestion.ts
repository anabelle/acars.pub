import type {
  AircraftInstance,
  AircraftModel,
  AirlineEntity,
  FlightOffer,
  Route,
} from "@acars/core";
import {
  canonicalRouteKey,
  getMaxRouteDistanceKm,
  legTicksFor,
  maxWeeklyFrequency,
  TICKS_PER_HOUR,
} from "@acars/core";
import { getAircraftById } from "@acars/data";
import { bestWeeklyFrequency, type FrequencySuggestion } from "./routeProjection.js";

export interface RouteSuggestionInput {
  route: Route;
  fleet: readonly AircraftInstance[];
  routes: readonly Route[];
  airline: Pick<AirlineEntity, "brandScore" | "tier" | "ceoPubkey">;
  registry?: Map<string, FlightOffer[]>;
  tick: number;
}

/**
 * The weekly frequency that earns an existing route the most for the planes
 * flying it (S58), at its current fares. The route's most common model stands
 * in for a mixed fleet. Null when no plane flies the route.
 */
export function suggestRouteFrequency(input: RouteSuggestionInput): FrequencySuggestion | null {
  const { route } = input;
  const assigned = input.fleet.filter((aircraft) => aircraft.assignedRouteId === route.id);
  if (assigned.length === 0) return null;
  const counts = new Map<string, number>();
  for (const aircraft of assigned) {
    counts.set(aircraft.modelId, (counts.get(aircraft.modelId) ?? 0) + 1);
  }
  let modelId = assigned[0].modelId;
  for (const [id, count] of counts) {
    if (count > (counts.get(modelId) ?? 0)) modelId = id;
  }
  const model = getAircraftById(modelId);
  if (!model) return null;
  return bestWeeklyFrequency({
    originIata: route.originIata,
    destinationIata: route.destinationIata,
    distanceKm: route.distanceKm,
    model,
    aircraftCount: assigned.length,
    fares: { economy: route.fareEconomy, business: route.fareBusiness, first: route.fareFirst },
    tick: input.tick,
    competitorOffers:
      input.registry?.get(canonicalRouteKey(route.originIata, route.destinationIata)) ?? [],
    playerPubkey: input.airline.ceoPubkey,
    playerBrandScore: input.airline.brandScore ?? 0.5,
    distanceLimitKm: getMaxRouteDistanceKm(input.airline.tier ?? 1),
    networkRoutes: input.routes,
  });
}

/** Under this many block hours a day a plane counts as idle (S58). */
export const IDLE_BLOCK_HOURS_PER_DAY = 6;

/**
 * Hours a day each plane on a route spends flying (block hours): the weekly
 * round trips it can actually fly, shared across the planes on the route.
 */
export function blockHoursPerAircraftPerDay(
  distanceKm: number,
  model: Pick<AircraftModel, "speedKmh" | "turnaroundTimeMinutes">,
  frequencyPerWeek: number,
  aircraftCount: number,
): number {
  if (aircraftCount <= 0) return 0;
  const legs = legTicksFor(distanceKm, model.speedKmh, model.turnaroundTimeMinutes);
  const flown = Math.min(
    frequencyPerWeek,
    maxWeeklyFrequency(legs.durationTicks, legs.turnaroundTicks, aircraftCount),
  );
  return (flown * 2 * legs.durationTicks) / TICKS_PER_HOUR / 7 / aircraftCount;
}
