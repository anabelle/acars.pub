/**
 * Brand score v2 (S11): brand rewards good service, not full planes at any
 * price. Each landing is graded on three inputs — fare against the market
 * reference, aircraft condition, and load factor within a healthy band — and
 * the brand moves toward the score that grade earns. O(1) per tick.
 */

import { detPow } from "./det-math.js";

/** Fare ÷ market reference fare at or below which a fare counts as fair. */
export const BRAND_FAIR_FARE_MAX = 1.2;
/** How far above the fair band (in fare ratio) the gouging penalty is full. */
export const BRAND_FARE_PENALTY_SPAN = 0.3;
/** Aircraft condition (0–1) below which passengers notice tired cabins. */
export const BRAND_MIN_CONDITION = 0.6;
/** How far below the minimum condition the condition penalty is full. */
export const BRAND_CONDITION_PENALTY_SPAN = 0.3;
/** Load-factor band that reads as a well-run, well-sized operation. */
export const BRAND_HEALTHY_LF_MIN = 0.6;
export const BRAND_HEALTHY_LF_MAX = 0.9;
/** Load factor below which empty flights hurt the brand. */
export const BRAND_EMPTY_LF = 0.5;
/** How far below the empty threshold the empty-flight penalty is full. */
export const BRAND_EMPTY_LF_PENALTY_SPAN = 0.3;

export interface BrandServiceInput {
  /** Passengers ÷ seats on the flight. */
  loadFactor: number;
  /** Economy fare ÷ market reference fare for the route. */
  fareRatio: number;
  /** Aircraft condition, 0 (worn out) to 1 (new). */
  condition: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Grade one flight's service for the brand, in [-1, 1].
 *
 * Penalties (gouging, worn aircraft, empty flights) each ramp linearly from 0
 * to -1 and add up. A flight with no penalty earns +1 only when its load
 * factor is in the healthy band; otherwise it is neutral. So filling planes
 * by overcharging, or flying half-empty over-assigned aircraft, loses brand.
 */
export function brandServiceGrade({ loadFactor, fareRatio, condition }: BrandServiceInput): number {
  const gouging = clamp((fareRatio - BRAND_FAIR_FARE_MAX) / BRAND_FARE_PENALTY_SPAN, 0, 1);
  const worn = clamp((BRAND_MIN_CONDITION - condition) / BRAND_CONDITION_PENALTY_SPAN, 0, 1);
  const empty = clamp((BRAND_EMPTY_LF - loadFactor) / BRAND_EMPTY_LF_PENALTY_SPAN, 0, 1);
  const penalty = gouging + worn + empty;
  if (penalty > 0) return -Math.min(1, penalty);
  return loadFactor >= BRAND_HEALTHY_LF_MIN && loadFactor <= BRAND_HEALTHY_LF_MAX ? 1 : 0;
}

/** Brand a grade earns if sustained: -1 → 0.1, 0 → 0.5, +1 → 0.9. */
export function brandTarget(grade: number): number {
  return 0.5 + 0.4 * clamp(grade, -1, 1);
}

/**
 * Share of the gap to the target that each landing closes. Reputation is the
 * memory of roughly the last 400 flights: a one-aircraft airline (≈2 landings
 * a day) moves ~14% of the way in a month, a ten-aircraft one ~78%.
 */
export const BRAND_LANDING_WEIGHT = 1 / 400;

/**
 * Brand after `landings` landings with average service grade `grade`: an
 * exponential pull toward {@link brandTarget}, closed form so a busy tick
 * costs O(1). Stays within [0.1, 1].
 */
export function nextBrandScore(brand: number, grade: number, landings: number): number {
  if (landings <= 0) return brand;
  const pull = 1 - detPow(1 - BRAND_LANDING_WEIGHT, landings);
  return clamp(brand + (brandTarget(grade) - brand) * pull, 0.1, 1);
}
