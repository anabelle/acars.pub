import type { AircraftInstance, AircraftModel, Route } from "@acars/core";
import { getAircraftById } from "@acars/data";

/** The three actions a one-click launch performs, in order. */
export type LaunchStep = "openRoute" | "acquireAircraft" | "assignAircraft";

export interface LaunchPlan {
  originIata: string;
  destinationIata: string;
  distanceKm: number;
  /** Aircraft to lease if no suitable idle aircraft is available at the origin. */
  model: AircraftModel;
}

/** Store actions and a fresh-state reader, injected so the flow is testable. */
export interface LaunchDeps {
  openRoute: (originIata: string, destinationIata: string, distanceKm: number) => Promise<void>;
  leaseAircraft: (model: AircraftModel, hubIata: string) => Promise<void>;
  assignAircraftToRoute: (aircraftId: string, routeId: string) => Promise<void>;
  getState: () => { routes: Route[]; fleet: AircraftInstance[] };
}

export interface LaunchResult {
  status: "complete" | "partial" | "failed";
  /** Steps that succeeded (or were already satisfied) in this run. */
  completed: LaunchStep[];
  failedStep?: LaunchStep;
  error?: string;
  routeId?: string;
  aircraftId?: string;
  /** True when an existing idle aircraft was reused instead of leasing one. */
  reusedAircraft?: boolean;
}

function findRoute(routes: Route[], plan: LaunchPlan): Route | undefined {
  return routes.find(
    (route) =>
      route.originIata === plan.originIata && route.destinationIata === plan.destinationIata,
  );
}

/**
 * An unassigned aircraft parked at the origin (idle, or still being
 * delivered) with the range for the route: exactly what a previous,
 * interrupted launch leaves behind, so a retry reuses it.
 */
function findAvailableAircraft(
  fleet: AircraftInstance[],
  plan: LaunchPlan,
): AircraftInstance | undefined {
  return fleet.find((aircraft) => {
    if (aircraft.assignedRouteId) return false;
    if (aircraft.status !== "idle" && aircraft.status !== "delivery") return false;
    if (aircraft.baseAirportIata !== plan.originIata) return false;
    const model = getAircraftById(aircraft.modelId);
    return !!model && model.rangeKm >= plan.distanceKm;
  });
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * One-click route launch: open the route, get an aircraft (reuse an idle one
 * at the origin, otherwise lease `plan.model`), assign it. Each step checks
 * the store first, so running it again after a partial failure resumes where
 * it stopped instead of opening a second route or leasing a second aircraft.
 */
export async function launchRoute(deps: LaunchDeps, plan: LaunchPlan): Promise<LaunchResult> {
  const completed: LaunchStep[] = [];
  const fail = (failedStep: LaunchStep, error: unknown, extra: Partial<LaunchResult> = {}) => ({
    status: completed.length > 0 ? ("partial" as const) : ("failed" as const),
    completed,
    failedStep,
    error: message(error),
    ...extra,
  });

  // 1. Route
  let route = findRoute(deps.getState().routes, plan);
  if (!route) {
    try {
      await deps.openRoute(plan.originIata, plan.destinationIata, plan.distanceKm);
    } catch (error) {
      return fail("openRoute", error);
    }
    route = findRoute(deps.getState().routes, plan);
    if (!route) return fail("openRoute", new Error("Route was not created."));
  }
  completed.push("openRoute");

  // Already flying this route with an aircraft? Nothing else to do.
  const alreadyAssigned = deps
    .getState()
    .fleet.find((aircraft) => aircraft.assignedRouteId === route.id);
  if (alreadyAssigned) {
    completed.push("acquireAircraft", "assignAircraft");
    return {
      status: "complete",
      completed,
      routeId: route.id,
      aircraftId: alreadyAssigned.id,
      reusedAircraft: true,
    };
  }

  // 2. Aircraft
  let aircraft = findAvailableAircraft(deps.getState().fleet, plan);
  const reusedAircraft = !!aircraft;
  if (!aircraft) {
    const before = new Set(deps.getState().fleet.map((a) => a.id));
    try {
      await deps.leaseAircraft(plan.model, plan.originIata);
    } catch (error) {
      return fail("acquireAircraft", error, { routeId: route.id });
    }
    aircraft = deps.getState().fleet.find((a) => !before.has(a.id) && a.modelId === plan.model.id);
    if (!aircraft) {
      return fail("acquireAircraft", new Error("Leased aircraft was not found in the fleet."), {
        routeId: route.id,
      });
    }
  }
  completed.push("acquireAircraft");

  // 3. Assignment
  try {
    await deps.assignAircraftToRoute(aircraft.id, route.id);
  } catch (error) {
    return fail("assignAircraft", error, {
      routeId: route.id,
      aircraftId: aircraft.id,
      reusedAircraft,
    });
  }
  completed.push("assignAircraft");

  return {
    status: "complete",
    completed,
    routeId: route.id,
    aircraftId: aircraft.id,
    reusedAircraft,
  };
}
