/**
 * Brand score v2 (S11): brand rewards good service, not full planes at any
 * price. Each landing is graded on three inputs — fare against the market
 * reference, aircraft condition, and load factor within a healthy band — and
 * the engine moves the airline's brand by the average grade. O(1) per landing.
 */

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
