import { BURST_POOL_SIZE, type MapBurst } from "@acars/map";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { useEffect, useState } from "react";
import { landingBursts } from "@/features/network/utils/landingBursts";
import { subscribeToNewTimelineEvents } from "@/shared/lib/timelineEvents";

/**
 * Money labels for the map (S43): your landings as they happen, newest last,
 * at most one pool's worth. Catch-ups after an absence are skipped (the away
 * report tells that story), like the timeline toasts.
 */
export function useLandingBursts(
  airportByIata: (iata: string) => { latitude: number; longitude: number } | undefined,
): MapBurst[] {
  const [bursts, setBursts] = useState<MapBurst[]>([]);

  useEffect(
    () =>
      subscribeToNewTimelineEvents(
        { airline: useAirlineStore, engine: useEngineStore },
        BURST_POOL_SIZE,
        (fresh) => {
          const next = landingBursts([...fresh].reverse(), airportByIata);
          if (next.length) setBursts((current) => [...current, ...next].slice(-BURST_POOL_SIZE));
        },
      ),
    [airportByIata],
  );

  return bursts;
}
