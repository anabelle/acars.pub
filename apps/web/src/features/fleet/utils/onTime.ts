import type { TimelineEvent } from "@acars/core";
import { ON_TIME_TICKS } from "@acars/core";

export interface OnTime {
  /** Landings that recorded a schedule (planes on lines). */
  flights: number;
  onTime: number;
  /** 0–1. */
  rate: number;
  /** Mean departure delay, in ticks. */
  averageDelayTicks: number;
}

/**
 * On-time performance (S66): the share of scheduled flights that left
 * within 15 minutes of schedule, from landings that recorded their delay —
 * one pass over the (capped) timeline. Null when no flight was scheduled.
 */
export function onTimePerformance(
  timeline: readonly TimelineEvent[],
  { sinceTick, aircraftId }: { sinceTick: number; aircraftId?: string },
): OnTime | null {
  let flights = 0;
  let onTime = 0;
  let delay = 0;
  for (const event of timeline) {
    if (event.type !== "landing" || event.tick < sinceTick) continue;
    if (aircraftId && event.aircraftId !== aircraftId) continue;
    const delayTicks = event.details?.delayTicks;
    if (typeof delayTicks !== "number") continue;
    flights += 1;
    delay += delayTicks;
    if (delayTicks <= ON_TIME_TICKS) onTime += 1;
  }
  if (flights === 0) return null;
  return { flights, onTime, rate: onTime / flights, averageDelayTicks: delay / flights };
}
