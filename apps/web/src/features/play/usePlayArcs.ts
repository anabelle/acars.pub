import type { Airport } from "@acars/core";
import { getAirports, isDataCatalogReady, whenDataCatalogReady } from "@acars/data";
import { useAirlineStore } from "@acars/store";
import { useEffect, useMemo, useState } from "react";
import { type ArcOwner, buildRouteArcs, type RouteArc } from "./arcs";

let airportIndex: Map<string, Airport> | null = null;
const lookupAirport = (iata: string) => airportIndex?.get(iata);

/** The world's active routes as arcs: rivals from world sync, then the player's. */
export function usePlayArcs(): RouteArc[] {
  const pubkey = useAirlineStore((s) => s.pubkey);
  const airline = useAirlineStore((s) => s.airline);
  const routes = useAirlineStore((s) => s.routes);
  const competitors = useAirlineStore((s) => s.competitors);
  const routesByOwner = useAirlineStore((s) => s.routesByOwner);
  const [catalogReady, setCatalogReady] = useState(isDataCatalogReady);

  useEffect(() => {
    let cancelled = false;
    void whenDataCatalogReady().then(() => {
      if (!cancelled) setCatalogReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    if (!catalogReady) return [];
    airportIndex ??= new Map(getAirports().map((a) => [a.iata, a]));
    const owners: ArcOwner[] = [];
    routesByOwner.forEach((ownerRoutes, owner) => {
      if (owner === pubkey) return;
      owners.push({
        routes: ownerRoutes,
        colorHex: competitors.get(owner)?.livery?.primary,
        isPlayer: false,
      });
    });
    owners.push({ routes, colorHex: airline?.livery?.primary, isPlayer: true });
    return buildRouteArcs(owners, lookupAirport);
  }, [catalogReady, routesByOwner, competitors, routes, airline, pubkey]);
}
