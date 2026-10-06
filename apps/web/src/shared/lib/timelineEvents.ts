import type { TimelineEvent } from "@acars/core";

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
