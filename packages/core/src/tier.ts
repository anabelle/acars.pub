import { fp, fpSum } from "./fixed-point.js";
import type { AircraftInstance, FixedPoint, Route } from "./types.js";

export interface TierThreshold {
  minCumulativeRevenue: FixedPoint;
  minActiveRoutes: number;
}

/**
 * Tuned with the S02 strategy sims (S12), then tripled in S58.2 when planes
 * started flying a real day (~3× the revenue): a balanced day-one airline
 * still reaches Tier 2 in a few days and Tier 3 in about a month.
 */
export const TIER_THRESHOLDS: Record<number, TierThreshold> = {
  2: {
    minCumulativeRevenue: fp(3_000_000),
    minActiveRoutes: 3,
  },
  3: {
    minCumulativeRevenue: fp(30_000_000),
    minActiveRoutes: 10,
  },
  4: {
    minCumulativeRevenue: fp(180_000_000),
    minActiveRoutes: 25,
  },
};

const MAX_TIER = 4;

/**
 * Computes the next tier based on cumulative revenue and active routes.
 */
export function evaluateTier(
  currentTier: number,
  cumulativeRevenue: FixedPoint,
  activeRouteCount: number,
): number {
  let nextTier = currentTier;
  for (let tier = currentTier + 1; tier <= MAX_TIER; tier += 1) {
    const threshold = TIER_THRESHOLDS[tier];
    if (!threshold) continue;
    if (cumulativeRevenue < threshold.minCumulativeRevenue) break;
    if (activeRouteCount < threshold.minActiveRoutes) break;
    nextTier = tier;
  }
  return nextTier;
}

/**
 * Returns the maximum allowed route distance by tier.
 */
export function getMaxRouteDistanceKm(tier: number): number {
  if (tier <= 1) return 3000;
  if (tier === 2) return 7000;
  return Number.POSITIVE_INFINITY;
}

/**
 * Returns the maximum allowed hub count by tier.
 */
export function getMaxHubs(tier: number): number {
  if (tier <= 1) return 1;
  if (tier === 2) return 3;
  if (tier === 3) return 5;
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Estimates legacy revenue to seed tier progression for existing airlines.
 */
export function estimateHistoricRevenue(fleet: AircraftInstance[], routes: Route[]): FixedPoint {
  if (fleet.length === 0) return fp(0);
  const fleetValue = fpSum(
    fleet.map((aircraft) => {
      return aircraft.purchasePrice ?? fp(0);
    }),
  );
  const activeRoutes = routes.filter((route) => route.status === "active").length;
  const routeBonus = fp(Math.min(activeRoutes, 25) * 2_000_000);
  return fpSum([fleetValue, routeBonus]);
}

export interface TierProgress {
  tier: number;
  /** Null at the top tier. */
  nextTier: number | null;
  /** 0–100, capped; 100 at the top tier. */
  revenuePct: number;
  routesPct: number;
  revenueMet: boolean;
  routesMet: boolean;
  revenueTarget: FixedPoint | null;
  routesTarget: number | null;
}

/**
 * How far an airline is towards its next tier on each requirement
 * (cumulative revenue and active routes). Pure and O(1).
 */
export function getTierProgress(
  tier: number,
  cumulativeRevenue: FixedPoint,
  activeRouteCount: number,
): TierProgress {
  const next = TIER_THRESHOLDS[tier + 1];
  if (!next) {
    return {
      tier,
      nextTier: null,
      revenuePct: 100,
      routesPct: 100,
      revenueMet: true,
      routesMet: true,
      revenueTarget: null,
      routesTarget: null,
    };
  }
  const pct = (value: number, target: number) =>
    Math.max(0, Math.min(100, Math.floor((value / target) * 100)));
  return {
    tier,
    nextTier: tier + 1,
    revenuePct: pct(cumulativeRevenue, next.minCumulativeRevenue),
    routesPct: pct(activeRouteCount, next.minActiveRoutes),
    revenueMet: cumulativeRevenue >= next.minCumulativeRevenue,
    routesMet: activeRouteCount >= next.minActiveRoutes,
    revenueTarget: next.minCumulativeRevenue,
    routesTarget: next.minActiveRoutes,
  };
}
