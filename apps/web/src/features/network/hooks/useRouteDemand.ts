import type { Airport, DemandResult, FixedPoint, Route } from "@acars/core";
import {
  buildHubState,
  type HubState,
  calculateDemand,
  calculatePriceElasticity,
  calculateSupplyPressure,
  getHubCongestionModifier,
  getHubDemandModifier,
  getProsperityIndex,
  getSeason,
  getSuggestedFares,
  PRICE_ELASTICITY_BUSINESS,
  PRICE_ELASTICITY_ECONOMY,
  PRICE_ELASTICITY_FIRST,
  scaleToAddressableMarket,
} from "@acars/core";
import { getAirports, HUB_CLASSIFICATIONS } from "@acars/data";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { useMemo } from "react";

export type RouteDemandSnapshot = {
  totalDemand: DemandResult;
  addressableDemand: DemandResult;
  pressureMultiplier: number;
  totalWeeklySeats: number;
  suggestedFleetDelta: number;
  isOversupplied: boolean;
  elasticityEconomy: number;
  elasticityBusiness: number;
  elasticityFirst: number;
  referenceFareEconomy: FixedPoint;
  referenceFareBusiness: FixedPoint;
  referenceFareFirst: FixedPoint;
  effectiveLoadFactor: number;
};

const DEFAULT_DEMAND: DemandResult = {
  origin: "",
  destination: "",
  economy: 0,
  business: 0,
  first: 0,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Module-level index over the airports catalog — replaces the linear
// `airports.find` scans (6k+ entries) that used to run twice per snapshot.
// Built lazily because the catalog now loads async after first paint.
let airportByIata: Map<string, Airport> | null = null;
function getAirportByIata(): Map<string, Airport> {
  if (!airportByIata) {
    airportByIata = new Map(getAirports().map((airport) => [airport.iata, airport]));
  }
  return airportByIata;
}

// Traffic/hub stats are O(routes) each; a full demand pass over N routes would
// be O(N²). Memoize them per routes-array reference so a pass is O(N).
type RouteStats = { traffic: Map<string, number>; hubState: Map<string, HubState> };
let routeStatsCache: { routes: readonly Route[] | null; stats: RouteStats | null } = {
  routes: null,
  stats: null,
};

function getRouteStats(routes: readonly Route[]): RouteStats {
  if (routeStatsCache.routes === routes && routeStatsCache.stats) return routeStatsCache.stats;
  const stats: RouteStats = { traffic: new Map(), hubState: new Map() };
  for (const route of routes) {
    const weekly = route.frequencyPerWeek ?? 0;
    const originTraffic = (stats.traffic.get(route.originIata) ?? 0) + weekly;
    stats.traffic.set(route.originIata, originTraffic);
    const destTraffic = (stats.traffic.get(route.destinationIata) ?? 0) + weekly;
    stats.traffic.set(route.destinationIata, destTraffic);
    if (!stats.hubState.has(route.originIata)) {
      stats.hubState.set(route.originIata, buildHubState(route.originIata, routes as Route[]));
    }
    if (!stats.hubState.has(route.destinationIata)) {
      stats.hubState.set(
        route.destinationIata,
        buildHubState(route.destinationIata, routes as Route[]),
      );
    }
  }
  // getAirportTraffic divides summed weekly flights by 7*24 — the loop above
  // accumulates raw weekly frequencies, so apply the divisor once per entry.
  for (const [iata, weekly] of stats.traffic) {
    stats.traffic.set(iata, weekly / (7 * 24));
  }
  routeStatsCache = { routes, stats };
  return stats;
}

/**
 * Demand inputs (prosperity, season, network supply) do not change
// meaningfully within a minute of game time. Snapshots are memoized per
 * (route, tickBucket, fleet, routes) so per-tick recomputation is free.
 */
export const DEMAND_SNAPSHOT_BUCKET_TICKS = 20;

type SnapshotCacheEntry = {
  route: Route;
  fleet: RouteDemandFleet;
  routes: readonly Route[];
  bucket: number;
  snapshot: RouteDemandSnapshot;
};
const snapshotCache = new Map<string, SnapshotCacheEntry>();
const SNAPSHOT_CACHE_MAX_ENTRIES = 1024;

export function getRouteDemandSnapshotCached(
  route: Route,
  tick: number,
  fleet: RouteDemandFleet,
  routes: readonly Route[],
): RouteDemandSnapshot {
  const bucket = Math.floor(tick / DEMAND_SNAPSHOT_BUCKET_TICKS);
  const cached = snapshotCache.get(route.id);
  if (
    cached &&
    cached.bucket === bucket &&
    cached.route === route &&
    cached.fleet === fleet &&
    cached.routes === routes
  ) {
    return cached.snapshot;
  }
  const snapshot = getRouteDemandSnapshot(
    route,
    bucket * DEMAND_SNAPSHOT_BUCKET_TICKS,
    fleet,
    routes,
  );
  if (snapshotCache.size >= SNAPSHOT_CACHE_MAX_ENTRIES) snapshotCache.clear();
  snapshotCache.set(route.id, { route, fleet, routes, bucket, snapshot });
  return snapshot;
}

export function getRouteDemandSnapshot(
  route: Route,
  tick: number,
  fleet: RouteDemandFleet,
  routes: readonly Route[],
): RouteDemandSnapshot {
  const originIata = route.originIata;
  const destinationIata = route.destinationIata;
  const origin = getAirportByIata().get(originIata) ?? null;
  const destination = getAirportByIata().get(destinationIata) ?? null;

  if (!origin || !destination) {
    const referenceFares = getSuggestedFares(route.distanceKm);
    const elasticityEconomy = calculatePriceElasticity(
      route.fareEconomy,
      referenceFares.economy,
      PRICE_ELASTICITY_ECONOMY,
    );
    const elasticityBusiness = calculatePriceElasticity(
      route.fareBusiness,
      referenceFares.business,
      PRICE_ELASTICITY_BUSINESS,
    );
    const elasticityFirst = calculatePriceElasticity(
      route.fareFirst,
      referenceFares.first,
      PRICE_ELASTICITY_FIRST,
    );
    const blendedElasticity =
      elasticityEconomy * 0.75 + elasticityBusiness * 0.2 + elasticityFirst * 0.05;

    return {
      totalDemand: { ...DEFAULT_DEMAND, origin: originIata, destination: destinationIata },
      addressableDemand: { ...DEFAULT_DEMAND, origin: originIata, destination: destinationIata },
      pressureMultiplier: 0.15,
      totalWeeklySeats: 0,
      suggestedFleetDelta: 0,
      isOversupplied: false,
      elasticityEconomy,
      elasticityBusiness,
      elasticityFirst,
      referenceFareEconomy: referenceFares.economy,
      referenceFareBusiness: referenceFares.business,
      referenceFareFirst: referenceFares.first,
      effectiveLoadFactor: 0.15 * blendedElasticity,
    };
  }

  const now = new Date();
  const season = getSeason(destination.latitude, now);
  const prosperity = getProsperityIndex(tick);

  const originHub = originIata ? (HUB_CLASSIFICATIONS[originIata] ?? null) : null;
  const destHub = destinationIata ? (HUB_CLASSIFICATIONS[destinationIata] ?? null) : null;
  const routeStats = getRouteStats(routes);
  const originState =
    originHub && originIata ? (routeStats.hubState.get(originIata) ?? null) : null;
  const destState =
    destHub && destinationIata ? (routeStats.hubState.get(destinationIata) ?? null) : null;
  const hubModifier = getHubDemandModifier(
    originHub?.tier ?? null,
    destHub?.tier ?? null,
    originState,
    destState,
  );

  const originTraffic = originIata ? (routeStats.traffic.get(originIata) ?? 0) : 0;
  const destTraffic = destinationIata ? (routeStats.traffic.get(destinationIata) ?? 0) : 0;
  const originCapacity = originHub?.baseCapacityPerHour ?? 80;
  const destCapacity = destHub?.baseCapacityPerHour ?? 80;
  const originCongestion = getHubCongestionModifier(originCapacity, originTraffic);
  const destCongestion = getHubCongestionModifier(destCapacity, destTraffic);
  const congestionModifier = (originCongestion + destCongestion) / 2;

  const weeklyDemand = calculateDemand(origin, destination, season, prosperity, hubModifier);

  const totalDemand: DemandResult = {
    origin: originIata,
    destination: destinationIata,
    economy: Math.round(weeklyDemand.economy * congestionModifier),
    business: Math.round(weeklyDemand.business * congestionModifier),
    first: Math.round(weeklyDemand.first * congestionModifier),
  };

  const addressableDemand = scaleToAddressableMarket(totalDemand);

  const totalWeeklySeats = route.assignedAircraftIds.reduce((sum, aircraftId) => {
    const aircraft = fleet.find((item) => item.id === aircraftId);
    if (!aircraft) return sum;
    const cabin = aircraft.configuration ?? { economy: 0, business: 0, first: 0, cargoKg: 0 };
    return sum + (cabin.economy + cabin.business + cabin.first) * 7;
  }, 0);

  const weeklyAddressableTotal =
    addressableDemand.economy + addressableDemand.business + addressableDemand.first;
  const pressureMultiplier = calculateSupplyPressure(totalWeeklySeats, weeklyAddressableTotal);
  const isOversupplied = totalWeeklySeats > weeklyAddressableTotal;

  const referenceFares = getSuggestedFares(route.distanceKm);
  const elasticityEconomy = calculatePriceElasticity(
    route.fareEconomy,
    referenceFares.economy,
    PRICE_ELASTICITY_ECONOMY,
  );
  const elasticityBusiness = calculatePriceElasticity(
    route.fareBusiness,
    referenceFares.business,
    PRICE_ELASTICITY_BUSINESS,
  );
  const elasticityFirst = calculatePriceElasticity(
    route.fareFirst,
    referenceFares.first,
    PRICE_ELASTICITY_FIRST,
  );
  const demandTotal =
    addressableDemand.economy + addressableDemand.business + addressableDemand.first;
  const demandWeights =
    demandTotal > 0
      ? {
          economy: addressableDemand.economy / demandTotal,
          business: addressableDemand.business / demandTotal,
          first: addressableDemand.first / demandTotal,
        }
      : { economy: 0.75, business: 0.2, first: 0.05 };
  const blendedElasticity =
    elasticityEconomy * demandWeights.economy +
    elasticityBusiness * demandWeights.business +
    elasticityFirst * demandWeights.first;

  const targetLf = 0.85;
  const targetSeats =
    weeklyAddressableTotal > 0 ? Math.round((weeklyAddressableTotal * targetLf) / 7) : 0;

  const averageSeats =
    route.assignedAircraftIds.length > 0
      ? Math.round(totalWeeklySeats / Math.max(1, route.assignedAircraftIds.length))
      : 0;

  const suggestedFleetDelta =
    averageSeats > 0
      ? clamp(Math.round((targetSeats - totalWeeklySeats / 7) / averageSeats), -9, 9)
      : 0;

  return {
    totalDemand,
    addressableDemand,
    pressureMultiplier,
    totalWeeklySeats,
    suggestedFleetDelta,
    isOversupplied,
    elasticityEconomy,
    elasticityBusiness,
    elasticityFirst,
    referenceFareEconomy: referenceFares.economy,
    referenceFareBusiness: referenceFares.business,
    referenceFareFirst: referenceFares.first,
    effectiveLoadFactor: pressureMultiplier * blendedElasticity,
  };
}

type RouteDemandFleet = readonly {
  id: string;
  configuration?: { economy: number; business: number; first: number; cargoKg: number };
}[];

export function useRouteDemand(route: Route): RouteDemandSnapshot {
  const tick = useEngineStore((state) => state.tick);
  const fleet = useAirlineStore((state) => state.fleet);
  const routes = useAirlineStore((state) => state.routes);

  // The cached getter makes intra-bucket ticks (bucket = 20 ticks ≈ 1 minute)
  // free — the memo below re-runs but returns the memoized snapshot.
  return useMemo(
    () => getRouteDemandSnapshotCached(route, tick, fleet, routes),
    [route, tick, fleet, routes],
  );
}
