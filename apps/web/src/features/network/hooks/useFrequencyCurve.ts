import type { Route } from "@acars/core";
import { TICKS_PER_HOUR } from "@acars/core";
import {
  type Curve,
  frequencyCurve,
  routeProjectionInputFor,
  useAirlineStore,
  useEngineStore,
} from "@acars/store";
import { useMemo } from "react";

/**
 * The frequency what-if for a flying route (S64): about 16 O(1) projections,
 * re-run at most once per game hour and only while `enabled` (the chart is open).
 */
export function useFrequencyCurve(route: Route, enabled: boolean): Curve | null {
  const fleet = useAirlineStore((s) => s.fleet);
  const routes = useAirlineStore((s) => s.routes);
  const airline = useAirlineStore((s) => s.airline);
  const registry = useAirlineStore((s) => s.globalRouteRegistry);
  const hourTick = useEngineStore((s) => Math.floor(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR);
  return useMemo(() => {
    if (!enabled || !airline) return null;
    const input = routeProjectionInputFor({
      route,
      fleet,
      routes,
      airline,
      registry,
      tick: hourTick,
    });
    return input ? frequencyCurve(input) : null;
  }, [enabled, route, fleet, routes, airline, registry, hourTick]);
}
