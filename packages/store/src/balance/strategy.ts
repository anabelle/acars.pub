import type { FixedPoint } from "@acars/core";
import {
  evaluateTier,
  fp,
  fpAdd,
  fpScale,
  fpSub,
  fpSum,
  leaseDeposit,
  ROUTE_SLOT_FEE,
} from "@acars/core";
import { getAircraftById, getAirports } from "@acars/data";
import { bestWeeklyFrequency } from "../routeProjection.js";
import { type LegMetrics, routeDistanceKm, runLegScenario } from "./legScenario.js";

/** Starting cash for a new airline (identity setup). */
export const STARTING_BALANCE = fp(100_000_000);
const DAYS_PER_LEASE_MONTH = 30;

export interface Strategy {
  name: string;
  description: string;
  modelId: string;
  /** Aircraft to lease on day one; "max" leases as many as the cash allows. */
  aircraft: number | "max";
  fareMultiplier: number;
}

export const STRATEGIES: Strategy[] = [
  {
    name: "Cautious",
    description: "3 ATR 72s, suggested fares",
    modelId: "atr72-600",
    aircraft: 3,
    fareMultiplier: 1,
  },
  {
    name: "Balanced",
    description: "10 ATR 72s, 1.2× fares (top of the fair band)",
    modelId: "atr72-600",
    aircraft: 10,
    fareMultiplier: 1.2,
  },
  {
    // S12: with fares capped at 3× and a real market, overpricing no longer
    // pays; greedy now means max lease at the revenue-maximising fare.
    name: "Greedy",
    description: "lease every ATR 72 the cash allows, 1.4× fares",
    modelId: "atr72-600",
    aircraft: "max",
    fareMultiplier: 1.4,
  },
];

export interface StrategyResult {
  strategy: Strategy;
  aircraft: number;
  routes: number;
  upfrontCost: FixedPoint;
  profitPerDay: FixedPoint;
  revenuePerDay: FixedPoint;
  /** Day (1-based) each tier was reached, or null within the horizon. */
  daysToTier: Record<2 | 3 | 4, number | null>;
  balanceAfter30Days: FixedPoint;
}

/**
 * Destinations for a hub: the most populous airports between 250 km and the
 * model's range, one per city, in descending population. Deterministic.
 */
export function hubDestinations(hubIata: string, maxKm: number, count: number): string[] {
  const seenCities = new Set<string>();
  const hub = getAirports().find((airport) => airport.iata === hubIata);
  if (hub) seenCities.add(`${hub.country}:${hub.city}`);
  const candidates = getAirports()
    .filter((airport) => airport.iata && airport.iata !== hubIata)
    .map((airport) => ({ airport, km: routeDistanceKm(hubIata, airport.iata) }))
    .filter(({ km }) => km >= 250 && km <= maxKm)
    .sort(
      (a, b) =>
        b.airport.population - a.airport.population || a.airport.iata.localeCompare(b.airport.iata),
    );
  const result: string[] = [];
  for (const { airport } of candidates) {
    const city = `${airport.country}:${airport.city}`;
    if (seenCities.has(city)) continue;
    seenCities.add(city);
    result.push(airport.iata);
    if (result.length === count) break;
  }
  return result;
}

/**
 * Simulates a day-one strategy for `days` days: one leased aircraft per
 * route from `hubIata`, each route's economics taken from a real engine leg
 * (see runLegScenario) at the route's scheduled cadence. Pure and O(days).
 * Ignores the 3-minute delivery and network effects between routes.
 */
export function simulateStrategy(
  strategy: Strategy,
  {
    hubIata = "MAD",
    days = 365,
    maxDestinations = 40,
    utilization = "default",
  }: {
    hubIata?: string;
    days?: number;
    maxDestinations?: number;
    /** "default": 7 round trips a week; "best": the S58 suggested frequency. */
    utilization?: "default" | "best";
  } = {},
): StrategyResult {
  const model = getAircraftById(strategy.modelId);
  if (!model) throw new Error(`Unknown model ${strategy.modelId}`);
  const perAircraftUpfront = fpAdd(leaseDeposit(model.price), ROUTE_SLOT_FEE);
  const destinations = hubDestinations(hubIata, model.rangeKm, maxDestinations);
  const affordable = Math.floor(Number(STARTING_BALANCE) / Math.max(1, Number(perAircraftUpfront)));
  const aircraft = Math.min(
    strategy.aircraft === "max" ? affordable : strategy.aircraft,
    destinations.length,
  );

  const legs: LegMetrics[] = destinations.slice(0, aircraft).map((destinationIata) =>
    runLegScenario({
      originIata: hubIata,
      destinationIata,
      modelId: strategy.modelId,
      fareMultiplier: strategy.fareMultiplier,
      aircraftCount: 1,
      frequencyPerWeek:
        utilization === "best"
          ? bestWeeklyFrequency({
              originIata: hubIata,
              destinationIata,
              distanceKm: routeDistanceKm(hubIata, destinationIata),
              model,
              tick: 1,
            }).frequencyPerWeek
          : undefined,
    }),
  );
  const leasePerDay = fpScale(model.monthlyLease, aircraft / DAYS_PER_LEASE_MONTH);
  const revenuePerDay = fpSum(
    legs.map((leg) => fpScale(leg.revenuePerLeg, leg.legsPerDayPerAircraft)),
  );
  const profitPerDay = fpSub(fpSum(legs.map((leg) => leg.profitPerDay)), leasePerDay);
  const upfrontCost = fpScale(perAircraftUpfront, aircraft);

  let balance = fpSub(STARTING_BALANCE, upfrontCost);
  let cumulativeRevenue = fp(0);
  let tier = 1;
  let balanceAfter30Days = balance;
  const daysToTier: StrategyResult["daysToTier"] = { 2: null, 3: null, 4: null };
  for (let day = 1; day <= days; day += 1) {
    balance = fpAdd(balance, profitPerDay);
    cumulativeRevenue = fpAdd(cumulativeRevenue, revenuePerDay);
    const nextTier = evaluateTier(tier, cumulativeRevenue, aircraft);
    for (let reached = tier + 1; reached <= nextTier; reached += 1) {
      daysToTier[reached as 2 | 3 | 4] = day;
    }
    tier = nextTier;
    if (day === 30) balanceAfter30Days = balance;
  }

  return {
    strategy,
    aircraft,
    routes: aircraft,
    upfrontCost,
    profitPerDay,
    revenuePerDay,
    daysToTier,
    balanceAfter30Days,
  };
}
