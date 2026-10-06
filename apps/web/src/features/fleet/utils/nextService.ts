import type { AircraftInstance, AircraftModel, MaintenancePolicy, Route } from "@acars/core";
import {
  AUTO_MAINTENANCE_HOURS_SHARE,
  CONDITION_WEAR_PER_FLIGHT_HOUR,
  GROUNDED_MAX_HOURS_SINCE_CHECK,
  GROUNDED_MIN_CONDITION,
} from "@acars/core";

/**
 * Flight hours a day this aircraft flies on its route (S13): the route's
 * round trips a week shared by its aircraft, capped by the model's daily
 * block hours. Zero when unassigned.
 */
export function flightHoursPerDay(
  model: Pick<AircraftModel, "speedKmh" | "blockHoursPerDay">,
  route: Pick<Route, "distanceKm" | "frequencyPerWeek" | "assignedAircraftIds"> | null,
): number {
  if (!route) return 0;
  const legHours = route.distanceKm / (model.speedKmh || 800);
  const aircraft = Math.max(1, route.assignedAircraftIds.length);
  const perDay = ((route.frequencyPerWeek ?? 7) * 2 * legHours) / 7 / aircraft;
  return Math.min(model.blockHoursPerDay, perDay);
}

export interface NextService {
  /** "service" when the policy will service it; "grounding" when nothing will. */
  kind: "service" | "grounding";
  /** Whole days, at least 0. */
  days: number;
}

/**
 * When this aircraft next needs the hangar: under an enabled policy, when it
 * reaches the policy's condition or 90% of the hours limit; otherwise when it
 * would ground. Null when it isn't flying (no utilization to project).
 */
export function estimateNextService(
  aircraft: Pick<AircraftInstance, "condition" | "flightHoursSinceCheck">,
  policy: MaintenancePolicy,
  hoursPerDay: number,
): NextService | null {
  if (hoursPerDay <= 0) return null;
  const kind = policy.enabled ? "service" : "grounding";
  const conditionFloor = policy.enabled ? policy.minCondition : GROUNDED_MIN_CONDITION;
  const hoursLimit = policy.enabled
    ? GROUNDED_MAX_HOURS_SINCE_CHECK * AUTO_MAINTENANCE_HOURS_SHARE
    : GROUNDED_MAX_HOURS_SINCE_CHECK;
  const hoursLeft = Math.min(
    (aircraft.condition - conditionFloor) / CONDITION_WEAR_PER_FLIGHT_HOUR,
    hoursLimit - aircraft.flightHoursSinceCheck,
  );
  // Epsilon: wear is a binary fraction, so 0.02 / 0.00005 lands at 399.999…
  return { kind, days: Math.max(0, Math.floor(hoursLeft / hoursPerDay + 1e-9)) };
}
