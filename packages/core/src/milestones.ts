/**
 * Milestone rungs between tiers (S12): small, frequent goals so a player gets
 * a reward every few days, not weeks. Each milestone is a target on one
 * metric of airline state, so meeting it and measuring progress towards it
 * are pure O(1) functions.
 */

import { fp, fpToNumber } from "./fixed-point.js";
import type { AircraftInstance, AircraftModel, AirlineEntity, FixedPoint, Route } from "./types.js";

export type MilestoneMetric =
  | "activeRoutes"
  | "cumulativeRevenue"
  | "fleetSize"
  | "ownedAircraft"
  | "jets"
  | "widebodies"
  | "hubs"
  | "brandScore";

export interface MilestoneState {
  activeRoutes: number;
  /** Dollars (plain number) so every metric compares the same way. */
  cumulativeRevenue: number;
  fleetSize: number;
  ownedAircraft: number;
  jets: number;
  widebodies: number;
  hubs: number;
  brandScore: number;
}

export interface Milestone {
  id: string;
  metric: MilestoneMetric;
  target: number;
  /** Where progress is measured from, when the metric does not start at 0. */
  from?: number;
  /** Cash credited once when first met. */
  reward: FixedPoint;
}

/** Ordered roughly by when a balanced airline reaches them. */
export const MILESTONES: readonly Milestone[] = [
  { id: "first-route", metric: "activeRoutes", target: 1, reward: fp(100_000) },
  { id: "revenue-250k", metric: "cumulativeRevenue", target: 250_000, reward: fp(100_000) },
  { id: "three-routes", metric: "activeRoutes", target: 3, reward: fp(150_000) },
  { id: "revenue-1m", metric: "cumulativeRevenue", target: 1_000_000, reward: fp(250_000) },
  { id: "fleet-5", metric: "fleetSize", target: 5, reward: fp(250_000) },
  { id: "first-owned", metric: "ownedAircraft", target: 1, reward: fp(250_000) },
  { id: "five-routes", metric: "activeRoutes", target: 5, reward: fp(250_000) },
  { id: "first-jet", metric: "jets", target: 1, reward: fp(500_000) },
  { id: "revenue-5m", metric: "cumulativeRevenue", target: 5_000_000, reward: fp(500_000) },
  { id: "second-hub", metric: "hubs", target: 2, reward: fp(500_000) },
  { id: "brand-70", metric: "brandScore", target: 0.7, from: 0.5, reward: fp(500_000) },
  { id: "ten-routes", metric: "activeRoutes", target: 10, reward: fp(750_000) },
  { id: "revenue-25m", metric: "cumulativeRevenue", target: 25_000_000, reward: fp(1_000_000) },
  { id: "first-widebody", metric: "widebodies", target: 1, reward: fp(1_000_000) },
  { id: "fleet-25", metric: "fleetSize", target: 25, reward: fp(1_000_000) },
  { id: "revenue-100m", metric: "cumulativeRevenue", target: 100_000_000, reward: fp(2_000_000) },
];

/**
 * Snapshot of the metrics milestones read. `modelType` resolves an aircraft
 * model id to its type (core does not import the catalog).
 */
export function milestoneState(
  airline: Pick<AirlineEntity, "cumulativeRevenue" | "hubs" | "brandScore">,
  fleet: readonly Pick<AircraftInstance, "modelId" | "purchaseType">[],
  routes: readonly Pick<Route, "status">[],
  modelType: (modelId: string) => AircraftModel["type"] | undefined,
): MilestoneState {
  let ownedAircraft = 0;
  let jets = 0;
  let widebodies = 0;
  for (const aircraft of fleet) {
    if (aircraft.purchaseType !== "lease") ownedAircraft += 1;
    const type = modelType(aircraft.modelId);
    if (type && type !== "turboprop") jets += 1;
    if (type === "widebody") widebodies += 1;
  }
  return {
    activeRoutes: routes.filter((route) => route.status === "active").length,
    cumulativeRevenue: fpToNumber(airline.cumulativeRevenue ?? fp(0)),
    fleetSize: fleet.length,
    ownedAircraft,
    jets,
    widebodies,
    hubs: airline.hubs?.length ?? 0,
    brandScore: airline.brandScore ?? 0,
  };
}

export function isMilestoneMet(milestone: Milestone, state: MilestoneState): boolean {
  return state[milestone.metric] >= milestone.target;
}

/** Progress towards a milestone, 0–1. */
export function milestoneProgress(milestone: Milestone, state: MilestoneState): number {
  const from = milestone.from ?? 0;
  if (milestone.target <= from) return 1;
  return Math.min(1, Math.max(0, (state[milestone.metric] - from) / (milestone.target - from)));
}

/** Milestones met now that are not in `achieved`, in table order. */
export function newlyMetMilestones(
  state: MilestoneState,
  achieved: ReadonlySet<string>,
): Milestone[] {
  return MILESTONES.filter(
    (milestone) => !achieved.has(milestone.id) && isMilestoneMet(milestone, state),
  );
}

/** The next `count` unmet milestones, closest to completion first. */
export function nextMilestones(
  state: MilestoneState,
  achieved: ReadonlySet<string>,
  count = 3,
): Milestone[] {
  return MILESTONES.filter(
    (milestone) => !achieved.has(milestone.id) && !isMilestoneMet(milestone, state),
  )
    .map((milestone, order) => ({
      milestone,
      order,
      progress: milestoneProgress(milestone, state),
    }))
    .sort((a, b) => b.progress - a.progress || a.order - b.order)
    .slice(0, count)
    .map(({ milestone }) => milestone);
}
