import type { FixedPoint } from "@acars/core";

/**
 * Orders route opportunities by projected profit per day, best first. Markets
 * with no projection (no unlocked aircraft can fly them) go last, keeping
 * their original order. O(n log n) over a handful of candidates.
 */
export function rankByProfitPerDay<T>(
  markets: readonly T[],
  profitPerDay: (market: T) => FixedPoint | null,
): Array<{ market: T; profitPerDay: FixedPoint | null }> {
  return markets
    .map((market, index) => ({ market, profitPerDay: profitPerDay(market), index }))
    .sort((a, b) => {
      if (a.profitPerDay === null && b.profitPerDay === null) return a.index - b.index;
      if (a.profitPerDay === null) return 1;
      if (b.profitPerDay === null) return -1;
      return b.profitPerDay - a.profitPerDay || a.index - b.index;
    })
    .map(({ market, profitPerDay }) => ({ market, profitPerDay }));
}

/** A first route should land within this many hours of take-off (S55.1). */
export const FIRST_HOP_MAX_HOURS = 2;

/** Hours in the air, as the flight engine computes them (distance ÷ cruise speed). */
export function flightHours(distanceKm: number, speedKmh: number | undefined): number {
  return distanceKm / (speedKmh || 800);
}

/**
 * For an airline's first route: profitable short hops (landing within
 * FIRST_HOP_MAX_HOURS) first, so the first landing comes in the first
 * session, then everything else. Within each group the profit order is kept.
 */
export function rankForFirstRoute<T extends { profitPerDay: FixedPoint | null }>(
  ranked: readonly T[],
  hours: (entry: T) => number | null,
): T[] {
  const quick: T[] = [];
  const rest: T[] = [];
  for (const entry of ranked) {
    const h = hours(entry);
    if (
      entry.profitPerDay !== null &&
      entry.profitPerDay > 0 &&
      h !== null &&
      h <= FIRST_HOP_MAX_HOURS
    ) {
      quick.push(entry);
    } else {
      rest.push(entry);
    }
  }
  return [...quick, ...rest];
}
