import { GENESIS_TIME, TICK_DURATION, TICKS_PER_HOUR } from "@acars/core";

/** Absences shorter than this don't get a report. */
export const AWAY_REPORT_MIN_TICKS = TICKS_PER_HOUR;
/** The simulation counts as caught up within this many ticks of the wall clock (1 min). */
export const CAUGHT_UP_TOLERANCE_TICKS = 20;

const keyFor = (pubkey: string) => `acars:lastSeenTick:${pubkey}`;

/** Tick at the current wall-clock time (same formula as the engine's clock). */
export function wallClockTick(now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - GENESIS_TIME) / TICK_DURATION));
}

/** Last tick this player saw simulated, or null (never seen, or storage unavailable). */
export function readLastSeenTick(pubkey: string): number | null {
  try {
    const raw = window.localStorage.getItem(keyFor(pubkey));
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeLastSeenTick(pubkey: string, tick: number): void {
  try {
    window.localStorage.setItem(keyFor(pubkey), String(Math.floor(tick)));
  } catch {
    // Private mode or blocked storage: the report simply won't show.
  }
}

export type AwayDecision =
  | { kind: "wait" }
  | { kind: "none" }
  | { kind: "report"; fromTick: number; toTick: number };

/**
 * Pure decision for the "while you were away" report. Waits until the
 * airline's simulation has caught up with the wall clock (otherwise the
 * timeline doesn't contain the absence yet), then reports when the player was
 * last seen at least {@link AWAY_REPORT_MIN_TICKS} earlier.
 */
export function decideAwayReport(input: {
  lastSeenTick: number | null;
  simulatedTick: number | null;
  wallTick: number;
}): AwayDecision {
  const { lastSeenTick, simulatedTick, wallTick } = input;
  if (simulatedTick === null) return { kind: "wait" };
  if (simulatedTick < wallTick - CAUGHT_UP_TOLERANCE_TICKS) return { kind: "wait" };
  if (lastSeenTick === null) return { kind: "none" };
  if (simulatedTick - lastSeenTick < AWAY_REPORT_MIN_TICKS) return { kind: "none" };
  return { kind: "report", fromTick: lastSeenTick, toTick: simulatedTick };
}
