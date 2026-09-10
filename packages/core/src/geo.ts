// ============================================================
// @acars/core — Geography & Distance Calculations
// ============================================================
// Trig goes through det-math: haversine output feeds the gravity demand
// model (state chain), so it must be cross-runtime bit-deterministic.
// ============================================================

import { detAsin, detCos, detSin } from "./det-math.js";

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

/**
 * Calculate great-circle distance between two points using Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    detSin(dLat / 2) * detSin(dLat / 2) +
    detCos(lat1 * DEG_TO_RAD) * detCos(lat2 * DEG_TO_RAD) * detSin(dLon / 2) * detSin(dLon / 2);
  // 2·atan2(√a, √(1−a)) ≡ 2·asin(√a); sqrt is IEEE spec-exact.
  const c = 2 * detAsin(Math.sqrt(a));
  return EARTH_RADIUS_KM * c;
}
