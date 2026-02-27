// ============================================================
// @acars/core — Season Calculation
// ============================================================

import type { Season, AirportTag } from "./types.js";

/**
 * Determine the season at a given latitude for a given date.
 * Southern hemisphere seasons are inverted.
 */
export function getSeason(latitude: number, date: Date): Season {
  const month = date.getUTCMonth(); // 0-indexed
  const isNorthern = latitude >= 0;

  if (month >= 2 && month <= 4) return isNorthern ? "spring" : "autumn";
  if (month >= 5 && month <= 7) return isNorthern ? "summer" : "winter";
  if (month >= 8 && month <= 10) return isNorthern ? "autumn" : "spring";
  return isNorthern ? "winter" : "summer";
}

/** Seasonal demand multiplier based on route type */
const SEASONAL_MULTIPLIERS: Record<AirportTag, Record<Season, number>> = {
  beach: { summer: 1.3, winter: 0.7, spring: 1.0, autumn: 1.0 },
  ski: { summer: 0.6, winter: 1.4, spring: 0.9, autumn: 0.9 },
  business: { summer: 0.9, winter: 1.0, spring: 1.1, autumn: 1.1 },
  general: { summer: 1.1, winter: 0.9, spring: 1.0, autumn: 1.0 },
};

/**
 * Get the seasonal demand multiplier for a destination.
 * Uses the destination's primary tag. Falls back to 'general'.
 */
export function getSeasonalMultiplier(destinationTag: AirportTag, season: Season): number {
  return SEASONAL_MULTIPLIERS[destinationTag]?.[season] ?? 1.0;
}
