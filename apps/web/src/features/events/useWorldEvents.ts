import type { Route } from "@acars/core";
import { getAirports, isDataCatalogReady } from "@acars/data";
import { useEngineStore } from "@acars/store";
import { useMemo } from "react";
import { worldEventsBoard } from "./worldEventsView";

/** Ticks per recompute: the board changes on the hour, countdowns by the minute. */
const BOARD_BUCKET_TICKS = 20;

let cityIndex: Map<string, string> | null = null;
/** "Barcelona (BCN)" when the catalog is loaded, else the code. */
export function eventPlace(iata: string | null, worldwide: string): string {
  if (!iata) return worldwide;
  if (!cityIndex && isDataCatalogReady()) {
    cityIndex = new Map(getAirports().map((airport) => [airport.iata, airport.city]));
  }
  const city = cityIndex?.get(iata);
  return city ? `${city} (${iata})` : iata;
}

/** The world's events with their effects, in the order the player should care. */
export function useWorldEventsBoard(
  routes: readonly Pick<Route, "originIata" | "destinationIata">[],
) {
  const bucket = useEngineStore((state) => Math.floor(state.tick / BOARD_BUCKET_TICKS));
  return useMemo(() => worldEventsBoard(bucket * BOARD_BUCKET_TICKS, routes), [bucket, routes]);
}
