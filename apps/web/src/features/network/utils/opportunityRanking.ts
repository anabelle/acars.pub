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
