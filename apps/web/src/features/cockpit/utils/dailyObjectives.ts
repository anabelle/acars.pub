import {
  type DailyObjective,
  evaluateDailyObjectives,
  type ObjectiveAirportLookup,
  type ObjectiveLedger,
  objectiveDayWindow,
  utcDateForTick,
} from "@acars/core";

export interface ObjectiveBoardItem {
  objective: DailyObjective;
  progress: number;
  complete: boolean;
  claimed: boolean;
}

export interface ObjectiveBoard {
  /** Today's UTC date (YYYY-MM-DD) at the engine tick. */
  date: string;
  items: ObjectiveBoardItem[];
  /** Yesterday's objectives that are complete but unclaimed (still claimable today). */
  carryover: ObjectiveBoardItem[];
  /** Ticks until today's objectives reset (UTC midnight). */
  ticksLeft: number;
}

/**
 * The cockpit's view of the daily objectives (S32.4). It runs the same
 * evaluator the replay uses to verify claims, so a "Claim" button only
 * shows when the claim will pay.
 */
export function deriveObjectiveBoard(params: {
  tick: number;
  ledger: ObjectiveLedger | undefined;
  lookup: ObjectiveAirportLookup;
}): ObjectiveBoard {
  const { tick, lookup } = params;
  const activity = params.ledger?.activity ?? [];
  const claimed = new Set(params.ledger?.claimed ?? []);
  const date = utcDateForTick(tick);
  const { startTick, endTick } = objectiveDayWindow(date);
  const yesterday = utcDateForTick(startTick - 1);

  const toItem = (entry: ReturnType<typeof evaluateDailyObjectives>[number]) => ({
    ...entry,
    claimed: claimed.has(entry.objective.id),
  });

  return {
    date,
    items: evaluateDailyObjectives(date, activity, lookup).map(toItem),
    carryover: evaluateDailyObjectives(yesterday, activity, lookup)
      .map(toItem)
      .filter((item) => item.complete && !item.claimed),
    ticksLeft: endTick - tick,
  };
}
