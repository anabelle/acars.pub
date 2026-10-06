import { MAX_ROUTE_FREQUENCY_PER_WEEK, nextBrandScore } from "@acars/core";
import { type LegMetrics, runLegScenario } from "./legScenario.js";

/** Route used for the S11 over-assignment curve and brand trajectories. */
export const BRAND_MARKET = { origin: "MAD", destination: "LIS", modelId: "atr72-600" } as const;
export const MAX_CURVE_AIRCRAFT = 20;

/**
 * LF, route profit and brand grade as aircraft are piled onto one route,
 * every aircraft flying as much as it can (S11.3). Real engine legs.
 */
export function overAssignmentCurve(maxAircraft = MAX_CURVE_AIRCRAFT): LegMetrics[] {
  return Array.from({ length: maxAircraft }, (_, i) =>
    runLegScenario({
      originIata: BRAND_MARKET.origin,
      destinationIata: BRAND_MARKET.destination,
      modelId: BRAND_MARKET.modelId,
      fareMultiplier: 1,
      aircraftCount: i + 1,
      frequencyPerWeek: MAX_ROUTE_FREQUENCY_PER_WEEK,
    }),
  );
}

export interface BrandStrategy {
  name: string;
  description: string;
  aircraftCount: number;
  fareMultiplier: number;
}

export const BRAND_STRATEGIES: BrandStrategy[] = [
  {
    name: "Balanced",
    description: "2 ATR 72s, suggested fares",
    aircraftCount: 2,
    fareMultiplier: 1,
  },
  {
    name: "Greedy (over-assigned)",
    description: "10 ATR 72s, suggested fares",
    aircraftCount: 10,
    fareMultiplier: 1,
  },
  {
    name: "Greedy (gouging)",
    description: "2 ATR 72s, 2× fares",
    aircraftCount: 2,
    fareMultiplier: 2,
  },
];

export interface BrandTrajectory {
  strategy: BrandStrategy;
  leg: LegMetrics;
  landingsPerDay: number;
  /** Brand at the end of each day, day 0 = 0.5 (a new airline). */
  brandByDay: number[];
}

/**
 * Brand over `days` days on {@link BRAND_MARKET}: every landing grades like
 * the simulated leg, applied with the engine's own `nextBrandScore`.
 */
export function brandTrajectory(strategy: BrandStrategy, days = 30): BrandTrajectory {
  const leg = runLegScenario({
    originIata: BRAND_MARKET.origin,
    destinationIata: BRAND_MARKET.destination,
    modelId: BRAND_MARKET.modelId,
    fareMultiplier: strategy.fareMultiplier,
    aircraftCount: strategy.aircraftCount,
    frequencyPerWeek: MAX_ROUTE_FREQUENCY_PER_WEEK,
  });
  const landingsPerDay = leg.legsPerDayPerAircraft * strategy.aircraftCount;
  const brandByDay = [0.5];
  for (let day = 1; day <= days; day += 1) {
    brandByDay.push(nextBrandScore(brandByDay[day - 1], leg.brandGrade, landingsPerDay));
  }
  return { strategy, leg, landingsPerDay, brandByDay };
}
