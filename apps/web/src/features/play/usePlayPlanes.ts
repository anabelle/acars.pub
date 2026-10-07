import { GENESIS_TIME, TICK_DURATION } from "@acars/core";
import { getAirports, isDataCatalogReady, whenDataCatalogReady } from "@acars/data";
import { useAirlineStore } from "@acars/store";
import { useEffect, useMemo, useState } from "react";
import { type PlaneSchedule, planesFromFleet, syntheticPlanes } from "./aircraft";

/** Fractional engine tick for the wall clock (game time is 1:1 with UTC). */
export const nowTick = (): number => (Date.now() - GENESIS_TIME) / TICK_DURATION;

/** Synthetic traffic flies between the busiest airports, like real traffic. */
const SYNTHETIC_AIRPORT_POOL = 2000;

/** Loads the load generator accepts (`/play?load=…`). */
export const PLAY_LOADS = [0, 1000, 10000, 50000] as const;

export function parseLoad(search: string): number {
  const value = Number(new URLSearchParams(search).get("load"));
  return (PLAY_LOADS as readonly number[]).includes(value) ? value : 0;
}

/** Every aircraft in the air (player, rivals) plus `load` synthetic ones. */
export function usePlayPlanes(load: number): PlaneSchedule[] {
  const pubkey = useAirlineStore((s) => s.pubkey);
  const airline = useAirlineStore((s) => s.airline);
  const fleet = useAirlineStore((s) => s.fleet);
  const competitors = useAirlineStore((s) => s.competitors);
  const fleetByOwner = useAirlineStore((s) => s.fleetByOwner);
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

  const synthetic = useMemo(() => {
    if (!catalogReady || load === 0) return [];
    const pool = [...getAirports()]
      .sort((a, b) => b.population - a.population)
      .slice(0, SYNTHETIC_AIRPORT_POOL);
    return syntheticPlanes(load, pool, nowTick());
  }, [catalogReady, load]);

  const real = useMemo(() => {
    if (!catalogReady) return [];
    const index = new Map(getAirports().map((a) => [a.iata, a]));
    const owners: Parameters<typeof planesFromFleet>[0][number][] = [];
    fleetByOwner.forEach((ownerFleet, owner) => {
      if (owner === pubkey) return;
      owners.push({
        fleet: ownerFleet,
        colorHex: competitors.get(owner)?.livery?.primary,
        isPlayer: false,
      });
    });
    owners.push({ fleet, colorHex: airline?.livery?.primary, isPlayer: true });
    return planesFromFleet(owners, (iata) => index.get(iata));
  }, [catalogReady, fleetByOwner, competitors, fleet, airline, pubkey]);

  return useMemo(() => [...synthetic, ...real], [synthetic, real]);
}
