import type { Airport } from "@acars/core";
import { TICKS_PER_HOUR } from "@acars/core";
import { getAirports } from "@acars/data";
import {
  alliedRoutes,
  buildConnectionService,
  type HubConnections,
  useAirlineStore,
  useEngineStore,
} from "@acars/store";
import { useMemo } from "react";

let index: Map<string, Airport> | null = null;
const airportAt = (iata: string) => {
  if (!index || index.size === 0) index = new Map(getAirports().map((a) => [a.iata, a]));
  return index.get(iata);
};

/** Connecting passengers through one of the player's airports (S67), re-read once per game hour. */
export function useHubConnections(iata: string): HubConnections | null {
  const routes = useAirlineStore((s) => s.routes);
  const fleet = useAirlineStore((s) => s.fleet);
  // Codeshares (S73): allies' routes, recomputed when the alliance or their network changes.
  const airline = useAirlineStore((s) => s.airline);
  const pubkey = useAirlineStore((s) => s.pubkey);
  const competitors = useAirlineStore((s) => s.competitors);
  const routesByOwner = useAirlineStore((s) => s.routesByOwner);
  const allyRoutes = useMemo(
    () =>
      competitors && routesByOwner
        ? alliedRoutes({ airline, pubkey, competitors, routesByOwner })
        : [],
    [airline, pubkey, competitors, routesByOwner],
  );
  const hourTick = useEngineStore((s) => Math.floor(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR);
  return useMemo(
    () =>
      buildConnectionService(routes, fleet, hourTick, airportAt, allyRoutes).hubs.get(iata) ?? null,
    [routes, fleet, hourTick, iata, allyRoutes],
  );
}
