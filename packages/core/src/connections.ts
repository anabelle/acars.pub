import type { DemandResult } from "./types.js";
import { TICKS_PER_DAY, TICKS_PER_HOUR } from "./types.js";

/**
 * Connecting passengers (S67, D10): people flying A→B with no direct flight
 * by the airline can connect through its hub H on two of its flights. They
 * are counted in aggregate per leg (never one by one): a share of the A–B
 * market, smaller the longer the detour, larger the better the hub's
 * arrivals and departures line up (a bank).
 */

/** Share of the addressable A–B market that will connect through a hub at best. */
export const CONNECT_SHARE = 0.15;
/** A connection needs at least this long on the ground… */
export const MIN_CONNECT_TICKS = 45 * (TICKS_PER_HOUR / 60);
/** …and passengers will not wait longer than this. */
export const MAX_CONNECT_TICKS = 3 * TICKS_PER_HOUR;
/** Detours longer than this (A→H→B vs A→B) attract nobody. */
export const MAX_DETOUR_RATIO = 1.5;

/** 1 for a hub on the way, falling to 0 at a 50 % detour. */
export function detourFactor(directKm: number, firstLegKm: number, secondLegKm: number): number {
  if (!(directKm > 0)) return 0;
  const ratio = (firstLegKm + secondLegKm) / directKm;
  if (ratio <= 1) return 1;
  return Math.max(0, 1 - (ratio - 1) / (MAX_DETOUR_RATIO - 1));
}

/**
 * How well a hub connects (0.5–1): 0.5 when flights come and go at random
 * (route shuttles), up to 1 when every timed arrival has a departure 45 min
 * to 3 h later — a bank. Arrival and departure times are ticks after 00:00
 * UTC (from lines of flying). O(arrivals × departures) per hub, per hour.
 */
export function bankQuality(arrivals: readonly number[], departures: readonly number[]): number {
  if (arrivals.length === 0 || departures.length === 0) return 0.5;
  let connected = 0;
  for (const arrival of arrivals) {
    const ok = departures.some((departure) => {
      const wait = (((departure - arrival) % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
      return wait >= MIN_CONNECT_TICKS && wait <= MAX_CONNECT_TICKS;
    });
    if (ok) connected += 1;
  }
  return 0.5 + 0.5 * (connected / arrivals.length);
}

export interface WeeklyPax {
  economy: number;
  business: number;
  first: number;
}

/** Weekly connecting passengers of an A–B market through one hub. */
export function connectingDemand(
  addressable: Pick<DemandResult, "economy" | "business" | "first">,
  detour: number,
  quality: number,
): WeeklyPax {
  const k = CONNECT_SHARE * Math.max(0, Math.min(1, detour)) * Math.max(0, Math.min(1, quality));
  return {
    economy: Math.round(addressable.economy * k),
    business: Math.round(addressable.business * k),
    first: Math.round(addressable.first * k),
  };
}
