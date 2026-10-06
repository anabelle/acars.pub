import type { Airport } from "@acars/core";
import type { Feature } from "geojson";
import { makeArcFeature } from "./geo.js";

/** A route as the map draws it: who flies it, how often, and how it earns. */
export interface MapRoute {
  originIata: string;
  destinationIata: string;
  ownerPubkey: string;
  isPlayer: boolean;
  /** Round trips a week; drives line width. */
  frequencyPerWeek?: number;
  /** Operating profit per flight hour in dollars; drives the player's line colour. Null until flown. */
  profitPerHour?: number | null;
  /** Livery colour for rivals' lines. */
  color?: string;
}

export interface RouteFeatureProperties {
  owner: string;
  isPlayer: boolean;
  frequencyPerWeek: number;
  /** Raw profit per hour, or null when the route hasn't flown yet. */
  profitPerHour: number | null;
  /**
   * Profit normalised against the player's best and worst routes, −1 (worst
   * loss) … 0 … +1 (best profit); null when unknown. Colour expressions read
   * this, so the ramp works at any scale of airline.
   */
  profitScore: number | null;
  color: string | null;
}

/** New routes fly 7×/week (`openRoute`). */
const DEFAULT_FREQUENCY = 7;

/** The scale profit scores are measured against: the largest |profit| among the player's routes. */
export function profitScale(routes: readonly MapRoute[]): number {
  let scale = 0;
  for (const route of routes) {
    if (!route.isPlayer || route.profitPerHour == null) continue;
    scale = Math.max(scale, Math.abs(route.profitPerHour));
  }
  return scale;
}

/** Feature properties for one route; pure, O(1). */
export function routeFeatureProperties(route: MapRoute, scale: number): RouteFeatureProperties {
  const profit = route.profitPerHour ?? null;
  const score = profit === null ? null : scale > 0 ? Math.max(-1, Math.min(1, profit / scale)) : 0;
  return {
    owner: route.ownerPubkey,
    isPlayer: route.isPlayer,
    frequencyPerWeek: Math.max(1, route.frequencyPerWeek ?? DEFAULT_FREQUENCY),
    profitPerHour: profit,
    profitScore: score,
    color: route.color ?? null,
  };
}

/**
 * Line features for routes, drawn origin → destination (so a dash animation
 * flows in the direction of travel), with their styling properties. Routes
 * whose airports are unknown or that `include` rejects (viewport culling) are
 * skipped. O(routes); arc geometry comes from the caller's cache.
 */
export function buildRouteFeatures(
  routes: readonly MapRoute[],
  airportIndex: ReadonlyMap<string, Airport>,
  arcFor: (origin: Airport, destination: Airport) => [number, number][],
  include: (origin: Airport, destination: Airport) => boolean = () => true,
): Feature[] {
  const scale = profitScale(routes);
  const features: Feature[] = [];
  for (const route of routes) {
    const origin = airportIndex.get(route.originIata);
    const destination = airportIndex.get(route.destinationIata);
    if (!origin || !destination || !include(origin, destination)) continue;
    const feature = makeArcFeature(arcFor(origin, destination));
    feature.properties = { ...routeFeatureProperties(route, scale) };
    features.push(feature);
  }
  return features;
}
