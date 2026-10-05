import { useAirlineStore, useEngineStore } from "@acars/store";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAUGHT_UP_TOLERANCE_TICKS,
  decideAwayReport,
  readLastSeenTick,
  wallClockTick,
  writeLastSeenTick,
} from "@/features/airline/lib/lastSeen";
import {
  summarizeTimeline,
  type TimelineSummary,
} from "@/features/airline/utils/summarizeTimeline";

const HEARTBEAT_MS = 30_000;

/**
 * Tracks when the player last saw their airline (per pubkey, in
 * localStorage) and, once the simulation has caught up after an absence of an
 * hour or more, summarizes what happened. Covers both a fresh page load and a
 * tab that comes back from the background.
 *
 * Works through store subscriptions, so the 3-second tick doesn't re-render
 * the component that uses it.
 */
export function useAwayReport() {
  const [summary, setSummary] = useState<TimelineSummary | null>(null);
  // True once this visible stretch has been checked; reset when the tab hides.
  const decidedRef = useRef(false);

  useEffect(() => {
    const visible = () => document.visibilityState !== "hidden";

    const simulatedTick = () => {
      const { airline } = useAirlineStore.getState();
      return airline?.lastTick ?? null;
    };

    const recordLastSeen = () => {
      const { pubkey } = useAirlineStore.getState();
      const tick = simulatedTick();
      if (!pubkey || tick === null || !decidedRef.current) return;
      if (tick < wallClockTick() - CAUGHT_UP_TOLERANCE_TICKS) {
        // The simulation lags the clock: the device slept or the tab was
        // frozen without a visibilitychange. Keep the old last-seen tick and
        // check again once the engine has caught up.
        decidedRef.current = false;
        return;
      }
      writeLastSeenTick(pubkey, tick);
    };

    const check = () => {
      if (decidedRef.current || !visible()) return;
      const { pubkey, timeline, routes } = useAirlineStore.getState();
      if (!pubkey || useEngineStore.getState().catchupProgress) return;

      const decision = decideAwayReport({
        lastSeenTick: readLastSeenTick(pubkey),
        simulatedTick: simulatedTick(),
        wallTick: wallClockTick(),
      });
      if (decision.kind === "wait") return;

      decidedRef.current = true;
      if (decision.kind === "report") {
        setSummary(
          summarizeTimeline(timeline, decision.fromTick, decision.toTick, undefined, routes),
        );
      }
      recordLastSeen();
    };

    const onVisibilityChange = () => {
      if (visible()) {
        check();
      } else {
        // Remember the last tick seen, then re-check when the player comes back.
        recordLastSeen();
        decidedRef.current = false;
      }
    };

    // Identity switches (sign out / in) start a fresh check for the new pubkey.
    const unsubscribeAirline = useAirlineStore.subscribe((state, prev) => {
      if (state.pubkey !== prev.pubkey) decidedRef.current = false;
      if (state.airline !== prev.airline) check();
    });
    const unsubscribeEngine = useEngineStore.subscribe((state, prev) => {
      if (state.catchupProgress !== prev.catchupProgress) check();
    });
    const heartbeat = window.setInterval(() => {
      if (visible()) recordLastSeen();
    }, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", recordLastSeen);
    check();

    return () => {
      unsubscribeAirline();
      unsubscribeEngine();
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", recordLastSeen);
    };
  }, []);

  const dismiss = useCallback(() => setSummary(null), []);
  return { summary, dismiss };
}
