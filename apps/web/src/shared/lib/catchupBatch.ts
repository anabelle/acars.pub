import { TICKS_PER_HOUR } from "@acars/core";

/**
 * Simulation jumps at least this long are catch-ups after an absence; the
 * "while you were away" report (same 1 h threshold) tells their story.
 */
export const CATCHUP_BATCH_MIN_TICKS = TICKS_PER_HOUR;

/**
 * True when a timeline update came from catching up on an absence (or from
 * loading the airline), so its events should not be replayed as a toast burst.
 * `previousLastTick` / `nextLastTick` are the airline's `lastTick` before and
 * after the update that changed the timeline.
 */
export function isCatchupBatch(
  previousLastTick: number | null | undefined,
  nextLastTick: number | null | undefined,
): boolean {
  if (previousLastTick == null || nextLastTick == null) return true;
  return nextLastTick - previousLastTick >= CATCHUP_BATCH_MIN_TICKS;
}
