import type { TimelineEvent } from "@acars/core";
import { isCatchupBatch } from "@/shared/lib/catchupBatch";

/**
 * Events added to the front of `timeline` since `lastSeenId` (newest first),
 * at most `max`. With nothing seen yet, only the newest counts as new; if
 * the last seen event fell off the timeline, the newest `max` do.
 */
export function newTimelineEvents(
  timeline: readonly TimelineEvent[],
  lastSeenId: string | null,
  max: number,
): TimelineEvent[] {
  if (!timeline.length || timeline[0].id === lastSeenId) return [];
  if (!lastSeenId) return [timeline[0]];
  const lastIndex = timeline.findIndex((event) => event.id === lastSeenId);
  return lastIndex === -1 ? timeline.slice(0, max) : timeline.slice(0, Math.min(lastIndex, max));
}

interface TimelineStores {
  airline: {
    getState: () => { timeline: TimelineEvent[]; airline?: { lastTick?: number | null } | null };
    subscribe: (
      listener: (
        state: { timeline: TimelineEvent[]; airline?: { lastTick?: number | null } | null },
        previous: { timeline: TimelineEvent[]; airline?: { lastTick?: number | null } | null },
      ) => void,
    ) => () => void;
  };
  engine: {
    getState: () => { catchupProgress?: unknown };
    subscribe: (listener: (state: { catchupProgress?: unknown }) => void) => () => void;
  };
}

/**
 * Calls `onEvents` with the timeline events added live (newest first, at most
 * `max`), skipping catch-ups after an absence or while loading, which the
 * away report summarises instead. Shared by toasts, map labels and system
 * notifications. Returns an unsubscribe function.
 */
export function subscribeToNewTimelineEvents(
  stores: TimelineStores,
  max: number,
  onEvents: (events: TimelineEvent[]) => void,
): () => void {
  let lastSeenId = stores.airline.getState().timeline[0]?.id ?? null;
  let catchingUp = !!stores.engine.getState().catchupProgress;
  const unsubscribeCatchup = stores.engine.subscribe((state) => {
    catchingUp = !!state.catchupProgress;
  });
  const unsubscribeTimeline = stores.airline.subscribe((state, previous) => {
    if (state.timeline === previous.timeline) return;
    const latestId = state.timeline[0]?.id ?? null;
    const skip = catchingUp || isCatchupBatch(previous.airline?.lastTick, state.airline?.lastTick);
    const fresh = skip ? [] : newTimelineEvents(state.timeline, lastSeenId, max);
    lastSeenId = latestId;
    if (fresh.length) onEvents(fresh);
  });
  return () => {
    unsubscribeCatchup();
    unsubscribeTimeline();
  };
}
