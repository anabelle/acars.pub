import type { TimelineEvent } from "@acars/core";
import { TICKS_PER_HOUR } from "@acars/core";

export interface TurnedAway {
  boarded: number;
  turnedAway: number;
  /** People who stayed behind by destination, most first. */
  byDestination: { iata: string; count: number }[];
}

/**
 * The player's departures from an airport over the last 24 h (S63): who
 * boarded and who could not get a seat (the engine's spill), by destination.
 * One pass over the timeline; the people are counts, never simulated.
 */
export function turnedAwayAt(
  timeline: readonly TimelineEvent[],
  iata: string,
  tick: number,
): TurnedAway {
  const since = tick - TICKS_PER_HOUR * 24;
  let boarded = 0;
  let turnedAway = 0;
  const byDestination = new Map<string, number>();
  for (const event of timeline) {
    if (event.type !== "landing" || event.originIata !== iata) continue;
    if (event.tick <= since || event.tick > tick) continue;
    boarded += event.details?.passengers?.total ?? 0;
    const spilled = event.details?.spilledPassengers ?? 0;
    if (spilled > 0 && event.destinationIata) {
      turnedAway += spilled;
      byDestination.set(
        event.destinationIata,
        (byDestination.get(event.destinationIata) ?? 0) + spilled,
      );
    }
  }
  return {
    boarded,
    turnedAway,
    byDestination: [...byDestination.entries()]
      .map(([destination, count]) => ({ iata: destination, count }))
      .sort((a, b) => b.count - a.count || a.iata.localeCompare(b.iata)),
  };
}
