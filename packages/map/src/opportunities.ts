// =============================================================================
// Opportunity map (S43): projected profit per day of flying from a hub to
// each candidate destination, drawn as a heat glow (where the money is) and
// coloured points (green earns, red loses), sized by magnitude.
// =============================================================================

import type { Feature, Point } from "geojson";

export interface MapOpportunity {
  iata: string;
  longitude: number;
  latitude: number;
  /** Projected profit per day (dollars, display only). */
  profitPerDay: number;
}

export interface OpportunityProperties {
  iata: string;
  profitPerDay: number;
  /** Profit relative to the set's scale (see opportunityScale), clamped to −1…+1. */
  score: number;
  /** Heat weight: the positive part of `score` (losses add no glow). */
  weight: number;
}

/** Share of |profit| values below the scale; the rest saturate at ±1. */
export const OPPORTUNITY_SCALE_PERCENTILE = 0.8;

/**
 * The |profit| that maps to a full score: a high percentile rather than the
 * maximum, so one outlier destination doesn't flatten every other to "even".
 */
export function opportunityScale(opportunities: readonly MapOpportunity[]): number {
  const magnitudes = opportunities.map((o) => Math.abs(o.profitPerDay)).sort((a, b) => a - b);
  if (magnitudes.length === 0) return 1;
  const index = Math.min(
    magnitudes.length - 1,
    Math.floor((magnitudes.length - 1) * OPPORTUNITY_SCALE_PERCENTILE),
  );
  return Math.max(1, magnitudes[index]);
}

/** Point features with normalised scores, so styling works at any airline size. */
export function buildOpportunityFeatures(
  opportunities: readonly MapOpportunity[],
): Array<Feature<Point, OpportunityProperties>> {
  const scale = opportunityScale(opportunities);
  return opportunities.map((o) => {
    const score = Math.max(-1, Math.min(1, o.profitPerDay / scale));
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [o.longitude, o.latitude] },
      properties: {
        iata: o.iata,
        profitPerDay: o.profitPerDay,
        score: Math.round(score * 1000) / 1000,
        weight: Math.round(Math.max(0, score) * 1000) / 1000,
      },
    };
  });
}
