// ============================================================
// @acars/core — Quality Service Index (QSI)
// ============================================================
// See docs/ECONOMIC_MODEL.md §2 for full specification.
// ============================================================

import type { FlightOffer, PassengerClass, DemandResult } from "./types.js";
import { fpToNumber } from "./fixed-point.js";

/**
 * Canonical string comparison by UTF-16 code units. localeCompare is
 * locale/ICU-dependent and non-deterministic across runtimes — never use
 * it for canonical ordering (same pattern as canonicalRouteKey).
 */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// --- Weights (from ECONOMIC_MODEL.md §2.3) ---

type FactorWeights = {
  price: number;
  frequency: number;
  time: number;
  stops: number;
  service: number;
  brand: number;
};

const WEIGHTS: Record<PassengerClass, FactorWeights> = {
  economy: { price: 0.4, frequency: 0.15, time: 0.15, stops: 0.1, service: 0.1, brand: 0.1 },
  business: { price: 0.15, frequency: 0.3, time: 0.2, stops: 0.15, service: 0.1, brand: 0.1 },
  first: { price: 0.05, frequency: 0.2, time: 0.15, stops: 0.2, service: 0.25, brand: 0.15 },
};

/**
 * Calculates the market share (0.0 to 1.0) for each offer
 * for each passenger class, based on the QSI model.
 *
 * Note: QSI calculations use standard numbers, as IEEE-754 arithmetic
 * (+, -, *, /) is globally deterministic.
 */
export function calculateShares(
  offers: FlightOffer[],
): Record<PassengerClass, Map<string, number>> {
  const result: Record<PassengerClass, Map<string, number>> = {
    economy: new Map(),
    business: new Map(),
    first: new Map(),
  };

  if (offers.length === 0) {
    return result;
  }

  if (offers.length === 1) {
    // Monopoly: 100% share to the single offer
    result.economy.set(offers[0].airlinePubkey, 1.0);
    result.business.set(offers[0].airlinePubkey, 1.0);
    result.first.set(offers[0].airlinePubkey, 1.0);
    return result;
  }

  // --- Collect Extents ---
  let minPriceEconomy = Infinity;
  let maxPriceEconomy = -Infinity;
  let minPriceBusiness = Infinity;
  let maxPriceBusiness = -Infinity;
  let minPriceFirst = Infinity;
  let maxPriceFirst = -Infinity;

  let minTime = Infinity;
  let maxTime = -Infinity;

  let totalFrequency = 0;

  for (const offer of offers) {
    const pe = fpToNumber(offer.fareEconomy);
    const pb = fpToNumber(offer.fareBusiness);
    const pf = fpToNumber(offer.fareFirst);

    if (pe < minPriceEconomy) minPriceEconomy = pe;
    if (pe > maxPriceEconomy) maxPriceEconomy = pe;

    if (pb < minPriceBusiness) minPriceBusiness = pb;
    if (pb > maxPriceBusiness) maxPriceBusiness = pb;

    if (pf < minPriceFirst) minPriceFirst = pf;
    if (pf > maxPriceFirst) maxPriceFirst = pf;

    if (offer.travelTimeMinutes < minTime) minTime = offer.travelTimeMinutes;
    if (offer.travelTimeMinutes > maxTime) maxTime = offer.travelTimeMinutes;

    totalFrequency += offer.frequencyPerWeek;
  }

  // Prevent division by zero if all values are the same
  if (totalFrequency === 0) totalFrequency = 1;

  // --- Calculate QSI Scores ---
  let totalQSIE = 0;
  let totalQSIB = 0;
  let totalQSIF = 0;

  const qsiScores = offers.map((offer) => {
    const pe = fpToNumber(offer.fareEconomy);
    const pb = fpToNumber(offer.fareBusiness);
    const pf = fpToNumber(offer.fareFirst);

    // Fare normalization denominator: spread plus ~1% of the minimum fare
    // (absolute +1 would over-penalize cheap routes and under-penalize
    // expensive ones; min(fare)/100 keeps the smoothing scale-relative,
    // with a $1 floor so the denominator never collapses to zero spread).
    const fareScaleE = Math.max(1, minPriceEconomy / 100);
    const fareScaleB = Math.max(1, minPriceBusiness / 100);
    const fareScaleF = Math.max(1, minPriceFirst / 100);

    const priceScoreE =
      1.0 - (pe - minPriceEconomy) / (maxPriceEconomy - minPriceEconomy + fareScaleE);
    const priceScoreB =
      1.0 - (pb - minPriceBusiness) / (maxPriceBusiness - minPriceBusiness + fareScaleB);
    const priceScoreF = 1.0 - (pf - minPriceFirst) / (maxPriceFirst - minPriceFirst + fareScaleF);

    const frequencyScore = offer.frequencyPerWeek / totalFrequency;
    // Time is already in a natural absolute unit (minutes): keep +1 minute.
    const timeScore = 1.0 - (offer.travelTimeMinutes - minTime) / (maxTime - minTime + 1);

    const stopsScore = offer.stops === 0 ? 1.0 : offer.stops === 1 ? 0.5 : 0.2;

    const serviceScore = offer.serviceScore;
    const brandScore = offer.brandScore;

    const calcClassQSI = (cls: PassengerClass, priceScore: number) => {
      const w = WEIGHTS[cls];
      return (
        w.price * priceScore +
        w.frequency * frequencyScore +
        w.time * timeScore +
        w.stops * stopsScore +
        w.service * serviceScore +
        w.brand * brandScore
      );
    };

    const qsiE = calcClassQSI("economy", priceScoreE);
    const qsiB = calcClassQSI("business", priceScoreB);
    const qsiF = calcClassQSI("first", priceScoreF);

    totalQSIE += qsiE;
    totalQSIB += qsiB;
    totalQSIF += qsiF;

    return {
      airlinePubkey: offer.airlinePubkey,
      qsiE,
      qsiB,
      qsiF,
    };
  });

  // Prevent division by zero if all scores are 0
  if (totalQSIE === 0) totalQSIE = 1;
  if (totalQSIB === 0) totalQSIB = 1;
  if (totalQSIF === 0) totalQSIF = 1;

  // --- Calculate Market Shares ---
  // One airline may field multiple offers on a market (e.g. JFK→MAD and
  // MAD→JFK). Their per-class QSI must be AGGREGATED (summed) into a
  // single map entry before dividing by the total — a plain .set per
  // offer would overwrite siblings and make Σshares < 1, silently
  // evaporating passengers in allocatePassengers().
  const aggE = new Map<string, number>();
  const aggB = new Map<string, number>();
  const aggF = new Map<string, number>();

  for (const score of qsiScores) {
    aggE.set(score.airlinePubkey, (aggE.get(score.airlinePubkey) ?? 0) + score.qsiE);
    aggB.set(score.airlinePubkey, (aggB.get(score.airlinePubkey) ?? 0) + score.qsiB);
    aggF.set(score.airlinePubkey, (aggF.get(score.airlinePubkey) ?? 0) + score.qsiF);
  }

  for (const [pubkey, qsi] of aggE) result.economy.set(pubkey, qsi / totalQSIE);
  for (const [pubkey, qsi] of aggB) result.business.set(pubkey, qsi / totalQSIB);
  for (const [pubkey, qsi] of aggF) result.first.set(pubkey, qsi / totalQSIF);

  return result;
}

/**
 * Allocates integer passengers to each offer based on QSI market shares.
 * Uses the Largest Remainder Method (Hare-Niemeyer) to ensure exact totals
 * without losing or fabricating passengers.
 */
export function allocatePassengers(
  offers: FlightOffer[],
  demand: DemandResult,
): Map<string, { economy: number; business: number; first: number }> {
  const allocations = new Map<string, { economy: number; business: number; first: number }>();
  for (const offer of offers) {
    allocations.set(offer.airlinePubkey, { economy: 0, business: 0, first: 0 });
  }

  if (offers.length === 0) {
    return allocations;
  }

  const shares = calculateShares(offers);

  // Helper for allocating a specific class
  const allocateClass = (
    cls: PassengerClass,
    totalPassengers: number,
    classShares: Map<string, number>,
  ) => {
    if (totalPassengers === 0) return;

    let unallocated = totalPassengers;
    const remainders: Array<{ pubkey: string; remainder: number }> = [];

    // Distribute guaranteed seats based on Math.floor
    for (const [pubkey, share] of classShares.entries()) {
      const exact = totalPassengers * share;
      const guaranteed = Math.floor(exact);
      const r = exact - guaranteed;

      const current = allocations.get(pubkey)!;
      current[cls] = guaranteed;
      unallocated -= guaranteed;

      remainders.push({ pubkey, remainder: r });
    }

    // Sort by remainder descending, but fall back to canonical code-unit
    // pubkey comparison for determinism (localeCompare is ICU-dependent)!
    remainders.sort((a, b) => {
      if (b.remainder !== a.remainder) {
        return b.remainder - a.remainder;
      }
      return compareStrings(a.pubkey, b.pubkey);
    });

    // Distribute remaining single seats to those with highest remainders
    for (let i = 0; i < unallocated; i++) {
      const id = remainders[i].pubkey;
      allocations.get(id)![cls]++;
    }
  };

  allocateClass("economy", demand.economy, shares.economy);
  allocateClass("business", demand.business, shares.business);
  allocateClass("first", demand.first, shares.first);

  return allocations;
}
