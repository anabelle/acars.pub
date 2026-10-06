import { BURST_POOL_SIZE, type MapBurst } from "@acars/map";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { useEffect, useState } from "react";
import { landingBursts } from "@/features/network/utils/landingBursts";
import { isCatchupBatch } from "@/shared/lib/catchupBatch";
import { newTimelineEvents } from "@/shared/lib/timelineEvents";

/**
 * Money labels for the map (S43): your landings as they happen, newest last,
 * at most one pool's worth. Catch-ups after an absence are skipped (the away
 * report tells that story), like the timeline toasts.
 */
export function useLandingBursts(
  airportByIata: (iata: string) => { latitude: number; longitude: number } | undefined,
): MapBurst[] {
  const [bursts, setBursts] = useState<MapBurst[]>([]);

  useEffect(() => {
    let lastSeenId = useAirlineStore.getState().timeline[0]?.id ?? null;
    let catchingUp = !!useEngineStore.getState().catchupProgress;
    const unsubscribeCatchup = useEngineStore.subscribe((state) => {
      catchingUp = !!state.catchupProgress;
    });
    const unsubscribeTimeline = useAirlineStore.subscribe((state, previous) => {
      if (state.timeline === previous.timeline) return;
      const latestId = state.timeline[0]?.id ?? null;
      const skip =
        catchingUp || isCatchupBatch(previous.airline?.lastTick, state.airline?.lastTick);
      const fresh = skip ? [] : newTimelineEvents(state.timeline, lastSeenId, BURST_POOL_SIZE);
      lastSeenId = latestId;
      const next = landingBursts([...fresh].reverse(), airportByIata);
      if (next.length) setBursts((current) => [...current, ...next].slice(-BURST_POOL_SIZE));
    });
    return () => {
      unsubscribeCatchup();
      unsubscribeTimeline();
    };
  }, [airportByIata]);

  return bursts;
}
