import { fpScale, fpToNumber, getSuggestedFares } from "@acars/core";
import {
  bestWeeklyFrequency,
  projectRouteEconomics,
  type RouteProjection,
  type RouteProjectionInput,
} from "./routeProjection.js";

export interface CurvePoint {
  /** Weekly round trips, or the fare multiplier (1 = today's fares). */
  x: number;
  /** Operating profit per day, in dollars (for drawing; money stays fixed-point upstream). */
  profitPerDay: number;
  loadFactor: number;
  /** Our share of the city pair (0–1). */
  share: number;
}

export interface Curve {
  points: CurvePoint[];
  /** The x that earns the most. */
  best: number;
  /** The x the route uses now. */
  current: number;
  /** The physical / operating maximum (frequency curve only). */
  max?: number;
}

const point = (x: number, projection: RouteProjection): CurvePoint => ({
  x,
  profitPerDay: fpToNumber(projection.profitPerDay),
  loadFactor: projection.loadFactor,
  share: projection.marketShare,
});

const bestOf = (points: CurvePoint[]) =>
  points.reduce((best, p) => (p.profitPerDay > best.profitPerDay ? p : best), points[0]).x;

/**
 * What-if for frequency (S64): profit per day, load and share against weekly
 * round trips, from 1 to what the planes can fly in an operating day, plus
 * the current and the best. A fixed number of O(1) projections.
 */
export function frequencyCurve(input: RouteProjectionInput, samples = 14): Curve {
  const suggestion = bestWeeklyFrequency(input);
  const max = suggestion.maxFrequencyPerWeek;
  const current = input.frequencyPerWeek ?? 7;
  const xs = new Set<number>(
    [1, max, current, suggestion.frequencyPerWeek].filter((x) => x >= 1 && x <= max),
  );
  for (let i = 1; i < samples; i++) xs.add(Math.max(1, Math.round((max * i) / samples)));
  const points = [...xs]
    .sort((a, b) => a - b)
    .map((frequencyPerWeek) =>
      point(
        frequencyPerWeek,
        projectRouteEconomics({
          ...input,
          frequencyPerWeek,
          networkRoutes: input.networkRoutes?.map((route) =>
            route.originIata === input.originIata && route.destinationIata === input.destinationIata
              ? { ...route, frequencyPerWeek }
              : route,
          ),
        }),
      ),
    );
  return { points, best: bestOf(points), current: Math.min(current, max), max };
}

/** Fare multipliers the fare curve samples (60 % to 160 % of today's fares). */
export const FARE_STEPS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6] as const;

/**
 * What-if for fares (S64): profit per day, load and share if every fare moved
 * together from 60 % to 160 % of today's, at the route's frequency.
 */
export function fareCurve(input: RouteProjectionInput): Curve {
  const base = input.fares ?? getSuggestedFares(input.distanceKm);
  const points = FARE_STEPS.map((m) =>
    point(
      m,
      projectRouteEconomics({
        ...input,
        fares: {
          economy: fpScale(base.economy, m),
          business: fpScale(base.business, m),
          first: fpScale(base.first, m),
        },
      }),
    ),
  );
  return { points, best: bestOf(points), current: 1 };
}
