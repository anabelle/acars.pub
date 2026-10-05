import type { AircraftInstance, FixedPoint, Route, TimelineEvent } from "@acars/core";
import { getSuggestedFares } from "@acars/core";

export type ChecklistStepId =
  | "openRoute"
  | "firstTakeoff"
  | "firstLanding"
  | "adjustFare"
  | "thirdRoute";

export interface ChecklistStep {
  id: ChecklistStepId;
  done: boolean;
  /** Where to go to do this step. */
  to: "/network" | "/fleet";
  search?: { tab: "active" | "opportunities" };
}

export interface FirstHourChecklist {
  steps: ChecklistStep[];
  /** The first step not done yet, or null once the checklist is complete. */
  next: ChecklistStep | null;
  doneCount: number;
  complete: boolean;
}

export interface ChecklistInput {
  routes: ReadonlyArray<
    Pick<Route, "distanceKm" | "fareEconomy" | "fareBusiness" | "fareFirst" | "status">
  >;
  fleet: ReadonlyArray<Pick<AircraftInstance, "status" | "flight">>;
  cumulativeRevenue: FixedPoint;
  timeline?: ReadonlyArray<Pick<TimelineEvent, "type">>;
}

const differsFromSuggested = (route: ChecklistInput["routes"][number]) => {
  const suggested = getSuggestedFares(route.distanceKm);
  return (
    route.fareEconomy !== suggested.economy ||
    route.fareBusiness !== suggested.business ||
    route.fareFirst !== suggested.first
  );
};

/**
 * The guided first hour, derived only from airline state (no stored flags),
 * so it is the same on every device and survives a reload. Routes open with
 * the suggested fares, so a route priced differently means the player has
 * adjusted a fare. O(routes + fleet).
 */
export function deriveFirstHourChecklist(input: ChecklistInput): FirstHourChecklist {
  const routes = input.routes.filter((route) => route.status !== "suspended");
  const landed =
    input.cumulativeRevenue > 0 || (input.timeline ?? []).some((event) => event.type === "landing");
  const tookOff =
    landed ||
    input.fleet.some((aircraft) => aircraft.status === "enroute" || aircraft.flight !== null);

  const steps: ChecklistStep[] = [
    {
      id: "openRoute",
      done: routes.length >= 1,
      to: "/network",
      search: { tab: "opportunities" },
    },
    { id: "firstTakeoff", done: tookOff, to: "/fleet" },
    { id: "firstLanding", done: landed, to: "/network", search: { tab: "active" } },
    {
      id: "adjustFare",
      done: routes.some(differsFromSuggested),
      to: "/network",
      search: { tab: "active" },
    },
    {
      id: "thirdRoute",
      done: routes.length >= 3,
      to: "/network",
      search: { tab: "opportunities" },
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  return {
    steps,
    next: steps.find((step) => !step.done) ?? null,
    doneCount,
    complete: doneCount === steps.length,
  };
}
