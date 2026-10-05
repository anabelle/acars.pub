import type { FixedPoint } from "@acars/core";
import {
  fp,
  fpScale,
  fpToNumber,
  getSuggestedFares,
  haversineDistance,
  TICKS_PER_HOUR,
} from "@acars/core";
import { getAirports } from "@acars/data";
import {
  findLastEvent,
  initState,
  makeAircraft,
  makeRoute,
  runTick,
} from "../testing/engineFixtures.js";

const TICKS_PER_DAY = TICKS_PER_HOUR * 24;

export interface LegScenario {
  originIata: string;
  destinationIata: string;
  modelId: string;
  /** Multiple of the suggested fares in every cabin. */
  fareMultiplier: number;
  /** Aircraft assigned to the route (they share its demand). */
  aircraftCount: number;
}

export interface LegMetrics extends LegScenario {
  distanceKm: number;
  loadFactor: number;
  passengers: number;
  revenuePerLeg: FixedPoint;
  profitPerLeg: FixedPoint;
  /** Legs one aircraft flies per day at the engine's real cadence (block time + turnaround). */
  legsPerDayPerAircraft: number;
  /** Route profit per day: every aircraft, both directions, at this leg's result. */
  profitPerDay: FixedPoint;
}

let airportIndex: Map<string, { latitude: number; longitude: number }> | null = null;

export function routeDistanceKm(originIata: string, destinationIata: string): number {
  if (!airportIndex) {
    airportIndex = new Map(getAirports().map((airport) => [airport.iata, airport]));
  }
  const origin = airportIndex.get(originIata);
  const destination = airportIndex.get(destinationIata);
  if (!origin || !destination) {
    throw new Error(`Unknown airport in ${originIata}-${destinationIata}`);
  }
  return Math.round(
    haversineDistance(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    ),
  );
}

/**
 * Flies one outbound leg through the real `processFlightEngine` (solo market,
 * brand 0.5, tick 1 so fuel and season are fixed) and reports its economics.
 * The other `aircraftCount - 1` aircraft are assigned to the route so demand
 * is split exactly as the engine splits it; their legs are assumed identical.
 */
export function runLegScenario(scenario: LegScenario): LegMetrics {
  const distanceKm = routeDistanceKm(scenario.originIata, scenario.destinationIata);
  const suggested = getSuggestedFares(distanceKm);
  const route = makeRoute({
    originIata: scenario.originIata,
    destinationIata: scenario.destinationIata,
    distanceKm,
    assignedAircraftIds: Array.from({ length: scenario.aircraftCount }, (_, i) =>
      i === 0 ? "ac-1" : `ac-${i + 1}`,
    ),
    fareEconomy: fpScale(suggested.economy, scenario.fareMultiplier),
    fareBusiness: fpScale(suggested.business, scenario.fareMultiplier),
    fareFirst: fpScale(suggested.first, scenario.fareMultiplier),
  });
  const aircraft = makeAircraft({
    modelId: scenario.modelId,
    assignedRouteId: route.id,
    baseAirportIata: scenario.originIata,
  });

  let state = initState([aircraft], [route]);
  state = runTick(state, 1);
  const flight = state.fleet[0].flight;
  if (!flight) {
    throw new Error(
      `${scenario.modelId} did not take off on ${scenario.originIata}-${scenario.destinationIata} (range?)`,
    );
  }
  state = runTick(state, flight.arrivalTick);
  const landing = findLastEvent(state.events, "landing");
  const landed = state.fleet[0];
  if (!landing || landed.turnaroundEndTick === undefined) {
    throw new Error(`No landing for ${scenario.originIata}-${scenario.destinationIata}`);
  }

  const cycleTicks = landed.turnaroundEndTick - flight.departureTick;
  const legsPerDayPerAircraft = TICKS_PER_DAY / cycleTicks;
  const profitPerLeg = landing.profit ?? fp(0);

  return {
    ...scenario,
    distanceKm,
    loadFactor: landing.details?.loadFactor ?? 0,
    passengers: landing.details?.passengers?.total ?? 0,
    revenuePerLeg: landing.revenue ?? fp(0),
    profitPerLeg,
    legsPerDayPerAircraft,
    profitPerDay: fpScale(profitPerLeg, legsPerDayPerAircraft * scenario.aircraftCount),
  };
}

/** Profit per leg in whole dollars, for tables and comparisons. */
export const dollars = (value: FixedPoint) => Math.round(fpToNumber(value));
