import { fpAdd, fpScale, fpSub } from "./fixed-point.js";
import { detPow } from "./det-math.js";
import type { AircraftModel, FixedPoint } from "./types.js";
import { TICKS_PER_HOUR, TICKS_PER_MONTH } from "./types.js";

export function getMaintenanceDowntimeTicks(model: AircraftModel): number {
  switch (model.type) {
    case "turboprop":
      return 4 * TICKS_PER_HOUR;
    case "regional":
      return 6 * TICKS_PER_HOUR;
    case "narrowbody":
      return 8 * TICKS_PER_HOUR;
    case "widebody":
      return 12 * TICKS_PER_HOUR;
    default:
      return 6 * TICKS_PER_HOUR;
  }
}

/**
 * Computes the realistic weekly flight frequency for a route given the number of
 * assigned aircraft, route distance, aircraft speed and turnaround time.
 *
 * Each aircraft can complete N round-trips per week:
 *   roundTripHours = 2 * (distanceKm / speedKmh) + 2 * (turnaroundMinutes / 60)
 *   availableHoursPerWeek = blockHoursPerDay * 7
 *   tripsPerWeek = floor(availableHoursPerWeek / roundTripHours)
 *   totalFrequency = assignedAircraft * tripsPerWeek
 *
 * Falls back to assignedAircraft * 7 if model info is unavailable.
 */
export function computeRouteFrequency(
  distanceKm: number,
  assignedAircraftCount: number,
  speedKmh: number = 800,
  turnaroundMinutes: number = 35,
  blockHoursPerDay: number = 16,
): number {
  if (assignedAircraftCount <= 0) return 0;
  if (distanceKm <= 0 || speedKmh <= 0) return assignedAircraftCount * 7;

  const legHours = distanceKm / speedKmh;
  const turnaroundHours = turnaroundMinutes / 60;
  const roundTripHours = 2 * legHours + 2 * turnaroundHours;

  // Cap at realistic block hours per day (crew rest, maintenance windows)
  const hoursPerWeek = blockHoursPerDay * 7;
  const tripsPerAircraftPerWeek = Math.max(1, Math.floor(hoursPerWeek / roundTripHours));

  return assignedAircraftCount * tripsPerAircraftPerWeek;
}

/**
 * Calculates the current book value of an aircraft based on declining-balance
 * depreciation, condition penalties, and utilization penalties.
 */
export function calculateBookValue(
  model: AircraftModel,
  flightHoursTotal: number,
  condition: number, // 0.0 to 1.0
  manufactureTick: number,
  currentTick: number,
): FixedPoint {
  // 1. Calculate Age in Years
  const ticksPerDay = TICKS_PER_HOUR * 24;
  const ticksPerYear = ticksPerDay * 365;
  const ageTicks = Math.max(0, currentTick - manufactureTick);
  // Continuous (S12): value falls smoothly, not in yearly steps.
  const ageYears = ageTicks / ticksPerYear;

  // 2. Declining Balance Depreciation (Exponential)
  // Most aircraft lose 8-12% of their value per year.
  // We use a 10% annual depreciation rate for a realistic curve.
  const annualRate = 0.1;
  const residualPercent = model.residualValuePercent / 100;
  const residualValue = fpScale(model.price, residualPercent);

  // V = P * (1-r)^t (deterministic pow)
  let baseValue = fpScale(model.price, detPow(1 - annualRate, ageYears));

  // 3. Apply Condition Penalty (Up to 30% reduction)
  // 100% condition = 0 penalty. 50% condition = 15% penalty.
  const conditionPenalty = (1 - condition) * 0.3;
  baseValue = fpScale(baseValue, 1 - conditionPenalty);

  // 4. Heavy Utilization Penalty
  // Average utilization is model.blockHoursPerDay.
  // Penalize if the flight hour density is high.
  const expectedHours = model.blockHoursPerDay * 365 * ageYears;
  const utilizationRatio = expectedHours > 100 ? flightHoursTotal / expectedHours : 1.0;

  if (utilizationRatio > 1.2) {
    // High wear penalty (extra 10%)
    baseValue = fpScale(baseValue, 0.9);
  }

  // 5. Floor at residual value
  return baseValue > residualValue ? baseValue : residualValue;
}

// ============================================================
// Lease vs buy (S12)
// ============================================================

/**
 * Lease deposit, as a share of the aircraft price, paid up front and not
 * refunded. Large enough that cash, not route count, limits a day-one fleet
 * ($100M leases ~14 ATR 72s, not ~37), and below the 30% scrap loss so a
 * lease is the cheaper way to start.
 */
export const LEASE_DEPOSIT_SHARE = 0.25;
/**
 * Monthly lease payment as a share of the aircraft price (a "lease rate
 * factor"). With the deposit and the scrap resale below, leasing is cheaper
 * for the first ~3 years and buying wins from month ~40 on, for every model.
 */
export const LEASE_MONTHLY_RATE = 0.006;
/** Share of book value recovered when an owned aircraft is sold for scrap. */
export const SCRAP_RESALE_SHARE = 0.7;

export function leaseDeposit(price: FixedPoint): FixedPoint {
  return fpScale(price, LEASE_DEPOSIT_SHARE);
}

export function leaseMonthlyPayment(price: FixedPoint): FixedPoint {
  return fpScale(price, LEASE_MONTHLY_RATE);
}

/**
 * Net cost of operating one aircraft for `months` billing months, excluding
 * flying costs (identical either way). Buying: price minus what scrapping it
 * then returns (book value at full condition and normal use). Leasing: the
 * deposit plus the payments.
 */
export function ownershipCost(
  model: AircraftModel,
  months: number,
  purchaseType: "buy" | "lease",
): FixedPoint {
  const wholeMonths = Math.max(0, Math.floor(months));
  if (purchaseType === "lease") {
    return fpAdd(leaseDeposit(model.price), fpScale(model.monthlyLease, wholeMonths));
  }
  const ageTicks = wholeMonths * TICKS_PER_MONTH;
  const normalHours = (model.blockHoursPerDay * ageTicks) / (TICKS_PER_HOUR * 24);
  const bookValue = calculateBookValue(model, normalHours, 1, 0, ageTicks);
  return fpSub(model.price, fpScale(bookValue, SCRAP_RESALE_SHARE));
}

/**
 * Billing month from which buying stays no more expensive than leasing, or
 * null if leasing is still cheaper at `maxMonths`.
 */
export function leaseBuyBreakEvenMonths(model: AircraftModel, maxMonths = 360): number | null {
  const leaseCheaper = (month: number) =>
    ownershipCost(model, month, "lease") < ownershipCost(model, month, "buy");
  if (leaseCheaper(maxMonths)) return null;
  let month = maxMonths;
  while (month > 0 && !leaseCheaper(month - 1)) month -= 1;
  return month;
}
