import { type ObjectiveAirportLookup, objectiveDayWindow } from "@acars/core";
import { describe, expect, it } from "vitest";
import { deriveObjectiveBoard } from "./dailyObjectives";

// 2026-10-07: open a route ≥1,000 km, open a route to a business airport, adjust a schedule.
const DAY = objectiveDayWindow("2026-10-07");
const YESTERDAY = objectiveDayWindow("2026-10-06");
const lookup: ObjectiveAirportLookup = () => undefined;

describe("deriveObjectiveBoard()", () => {
  it("shows today's objectives with progress, claims and time left", () => {
    const board = deriveObjectiveBoard({
      tick: DAY.startTick + 1_200,
      ledger: {
        activity: [{ type: "frequencyUpdated", tick: DAY.startTick + 5, routeId: "r1" }],
        claimed: ["2026-10-07:adjustSchedule"],
      },
      lookup,
    });
    expect(board.date).toBe("2026-10-07");
    expect(board.ticksLeft).toBe(DAY.endTick - DAY.startTick - 1_200);
    expect(board.items.map((item) => [item.objective.kind, item.complete, item.claimed])).toEqual([
      ["openRoute", false, false],
      ["openRouteToTag", false, false],
      ["adjustSchedule", true, true],
    ]);
    expect(board.carryover).toEqual([]);
  });

  it("lists yesterday's completed, unclaimed objectives as still claimable", () => {
    // 2026-10-06 includes "adjust a schedule" and "tune fares".
    const activity = [
      { type: "frequencyUpdated" as const, tick: YESTERDAY.startTick + 5, routeId: "r1" },
      { type: "faresUpdated" as const, tick: YESTERDAY.startTick + 6, routeId: "r1" },
    ];
    const board = deriveObjectiveBoard({
      tick: DAY.startTick + 10,
      ledger: { activity, claimed: ["2026-10-06:tuneFares"] },
      lookup,
    });
    expect(board.carryover.map((item) => item.objective.id)).toEqual(["2026-10-06:adjustSchedule"]);
  });

  it("works without a ledger", () => {
    const board = deriveObjectiveBoard({ tick: DAY.startTick, ledger: undefined, lookup });
    expect(board.items.every((item) => item.progress === 0)).toBe(true);
  });
});
