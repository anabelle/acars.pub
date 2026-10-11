import { useAirlineStore } from "@acars/store";
import { useCallback, useState } from "react";
import { suggestPlaneName } from "@/features/fleet/utils/planeNames";
import {
  type LaunchPlan,
  type LaunchResult,
  launchRoute,
} from "@/features/network/utils/launchRoute";

export type LaunchState =
  | { phase: "idle" }
  | { phase: "running"; plan: LaunchPlan }
  | { phase: "done"; plan: LaunchPlan; result: LaunchResult };

/**
 * React wrapper around {@link launchRoute}: wires the airline store's actions
 * (leasing via `purchaseAircraft(..., "lease")`) and exposes the progress.
 * Calling `launch` again with the same plan after a partial failure resumes.
 */
export function useLaunchRoute() {
  const openRoute = useAirlineStore((s) => s.openRoute);
  const purchaseAircraft = useAirlineStore((s) => s.purchaseAircraft);
  const assignAircraftToRoute = useAirlineStore((s) => s.assignAircraftToRoute);
  const [state, setState] = useState<LaunchState>({ phase: "idle" });

  const launch = useCallback(
    async (plan: LaunchPlan): Promise<LaunchResult> => {
      setState({ phase: "running", plan });
      const result = await launchRoute(
        {
          openRoute,
          // A real name from the start (S61), never "<model> <n>".
          leaseAircraft: (model, hubIata) => {
            const { fleet, pubkey } = useAirlineStore.getState();
            const name = suggestPlaneName(
              `${pubkey ?? ""}:${fleet.length}`,
              fleet.map((aircraft) => aircraft.name),
            );
            return purchaseAircraft(model, hubIata, undefined, name, "lease");
          },
          assignAircraftToRoute,
          getState: () => {
            const { routes, fleet } = useAirlineStore.getState();
            return { routes, fleet };
          },
        },
        plan,
      );
      setState({ phase: "done", plan, result });
      return result;
    },
    [openRoute, purchaseAircraft, assignAircraftToRoute],
  );

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, launch, reset };
}
