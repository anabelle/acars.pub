import type { Airport } from "@acars/core";
import { TICKS_PER_HOUR } from "@acars/core";
import { getAirports } from "@acars/data";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { useMemo } from "react";
import { getFlightSeed } from "@/features/network/utils/flightBoard";
import { getFlightNumber } from "@/features/network/utils/flightNumber";
import { type AcarsMessage, buildAcarsFeed } from "../utils/acars";

let airportIndex: Map<string, Airport> | null = null;
function airportAt(iata: string) {
  if (!airportIndex || airportIndex.size === 0) {
    airportIndex = new Map(getAirports().map((airport) => [airport.iata, airport]));
  }
  return airportIndex.get(iata);
}

/**
 * The player's own ACARS feed (S65), or one of their planes': re-derived once per game
 * minute from the timeline and the planes in the air.
 */
export function useAcarsFeed({
  aircraftId,
  limit,
}: {
  aircraftId?: string;
  limit: number;
}): AcarsMessage[] {
  const icao = useAirlineStore((s) => s.airline?.icaoCode ?? "UNK");
  const fleet = useAirlineStore((s) => s.fleet);
  const timeline = useAirlineStore((s) => s.timeline);
  const minuteTick = useEngineStore(
    (state) => Math.floor(state.tick / (TICKS_PER_HOUR / 60)) * (TICKS_PER_HOUR / 60),
  );
  return useMemo(
    () =>
      buildAcarsFeed({
        timeline,
        fleet,
        tick: minuteTick,
        airport: airportAt,
        flightLabel: (aircraft) => getFlightNumber(icao, getFlightSeed(aircraft)),
        aircraftId,
        limit,
      }),
    [timeline, fleet, minuteTick, icao, aircraftId, limit],
  );
}
