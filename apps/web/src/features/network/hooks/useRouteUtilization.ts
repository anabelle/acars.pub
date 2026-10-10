import type { Route } from "@acars/core";
import { TICKS_PER_HOUR } from "@acars/core";
import { getAircraftById } from "@acars/data";
import {
  blockHoursPerAircraftPerDay,
  IDLE_BLOCK_HOURS_PER_DAY,
  suggestRouteFrequency,
  useAirlineStore,
  useEngineStore,
} from "@acars/store";
import { useCallback, useMemo, useState } from "react";

export interface RouteUtilization {
  /** Hours a day each plane on the route flies; null when none is assigned. */
  blockHours: number | null;
  idle: boolean;
  /** The suggested weekly frequency when it is above the current one. */
  suggestedFrequency: number | null;
  flyMore: () => Promise<void>;
  saving: boolean;
}

/**
 * How much the planes on a route fly, and the one-tap fix when they sit idle
 * (S58). The suggestion re-projects at most once per game hour.
 */
export function useRouteUtilization(route: Route | undefined): RouteUtilization {
  const fleet = useAirlineStore((s) => s.fleet);
  const routes = useAirlineStore((s) => s.routes);
  const airline = useAirlineStore((s) => s.airline);
  const registry = useAirlineStore((s) => s.globalRouteRegistry);
  const applySuggestedFrequency = useAirlineStore((s) => s.applySuggestedFrequency);
  const hourTick = useEngineStore((s) => Math.floor(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR);
  const [saving, setSaving] = useState(false);

  const current = route?.frequencyPerWeek ?? 7;
  const blockHours = useMemo(() => {
    if (!route) return null;
    const assigned = fleet.filter((aircraft) => aircraft.assignedRouteId === route.id);
    const model = assigned[0] ? getAircraftById(assigned[0].modelId) : undefined;
    if (!model) return null;
    return blockHoursPerAircraftPerDay(route.distanceKm, model, current, assigned.length);
  }, [fleet, route, current]);
  const suggestion = useMemo(
    () =>
      route && airline
        ? suggestRouteFrequency({ route, fleet, routes, airline, registry, tick: hourTick })
        : null,
    [route, fleet, routes, airline, registry, hourTick],
  );
  const routeId = route?.id;
  const flyMore = useCallback(async () => {
    if (!routeId) return;
    setSaving(true);
    try {
      await applySuggestedFrequency(routeId);
    } finally {
      setSaving(false);
    }
  }, [applySuggestedFrequency, routeId]);

  return {
    blockHours,
    idle: blockHours !== null && blockHours < IDLE_BLOCK_HOURS_PER_DAY,
    suggestedFrequency:
      suggestion && suggestion.frequencyPerWeek > current ? suggestion.frequencyPerWeek : null,
    flyMore,
    saving,
  };
}
