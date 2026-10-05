// ============================================================
// @acars/core — Incumbent carriers (S10, decision D1)
// ============================================================
// Every city pair big enough to sustain one is already served by an
// established (NPC) carrier flying at the suggested fare. Players win
// passengers from it with frequency and price, the way new entrants do:
// a player's share of a market is its frequency × attractiveness against
// the incumbent's. A player leg therefore draws roughly one incumbent
// planeload of demand whatever the market size, which is what makes price
// elasticity bite on big routes. Thin markets with too little demand for an
// incumbent stay uncontested. All functions are pure and O(1)/O(offers).
// ============================================================

import { detPow } from "./det-math.js";

/** Target load factor the incumbent schedules for. */
export const INCUMBENT_TARGET_LOAD_FACTOR = 0.8;
/** Below this many weekly round trips a market can't sustain an incumbent. */
export const INCUMBENT_MIN_WEEKLY_FREQUENCY = 3;
/**
 * How strongly a fare above the suggested one makes a player less attractive
 * than the incumbent (share ∝ fareRatio^-k). Applied on top of the
 * engine's price elasticity, so keep it moderate.
 */
export const INCUMBENT_FARE_SENSITIVITY = 1;

/** The incumbent's typical seats per flight: bigger aircraft on longer routes. */
export function incumbentSeatsPerFlight(distanceKm: number): number {
  if (distanceKm < 800) return 120;
  if (distanceKm < 3000) return 160;
  if (distanceKm < 7000) return 250;
  return 300;
}

export interface IncumbentOffer {
  /** Round trips a week, sized to carry the market at the target load factor. */
  frequencyPerWeek: number;
  seatsPerFlight: number;
}

/**
 * The incumbent serving a market with `weeklyDemand` passengers a week in one
 * direction, or null when the market is too thin to sustain one.
 */
export function getIncumbentOffer(weeklyDemand: number, distanceKm: number): IncumbentOffer | null {
  const seatsPerFlight = incumbentSeatsPerFlight(distanceKm);
  const frequencyPerWeek = weeklyDemand / (seatsPerFlight * INCUMBENT_TARGET_LOAD_FACTOR);
  if (!(frequencyPerWeek >= INCUMBENT_MIN_WEEKLY_FREQUENCY)) return null;
  return { frequencyPerWeek, seatsPerFlight };
}

/** A player offer as the incumbent sees it. */
export interface EntrantOffer {
  frequencyPerWeek: number;
  /** Player fare ÷ suggested fare for the class (1 = suggested). */
  fareRatio: number;
}

/** A player offer's pull against the incumbent: frequency × price attractiveness. */
function entrantWeight(offer: EntrantOffer): number {
  if (!(offer.frequencyPerWeek > 0)) return 0;
  const ratio = offer.fareRatio > 0 ? offer.fareRatio : 1e-6;
  return offer.frequencyPerWeek * detPow(ratio, -INCUMBENT_FARE_SENSITIVITY);
}

/**
 * Share (0–1) of a market's demand left to the players once the incumbent
 * (flying at the suggested fare, attractiveness 1) takes its part. With no
 * incumbent the players get everything.
 */
export function entrantMarketShare(
  incumbent: IncumbentOffer | null,
  entrants: readonly EntrantOffer[],
): number {
  let entrantsWeight = 0;
  for (const offer of entrants) entrantsWeight += entrantWeight(offer);
  if (entrantsWeight <= 0) return 0;
  if (!incumbent) return 1;
  return entrantsWeight / (entrantsWeight + incumbent.frequencyPerWeek);
}
