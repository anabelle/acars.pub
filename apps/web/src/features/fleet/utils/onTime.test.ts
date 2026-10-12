import type { TimelineEvent } from "@acars/core";
import { ON_TIME_TICKS } from "@acars/core";
import { describe, expect, it } from "vitest";
import { onTimePerformance } from "./onTime";

const landing = (
  id: string,
  tick: number,
  delayTicks?: number,
  aircraftId = "a1",
): TimelineEvent => ({
  id,
  tick,
  timestamp: 0,
  type: "landing",
  description: "",
  aircraftId,
  details: delayTicks === undefined ? {} : { delayTicks },
});

describe("onTimePerformance", () => {
  it("counts scheduled flights within 15 minutes, by plane and window", () => {
    const timeline = [
      landing("a", 100, 0),
      landing("b", 200, ON_TIME_TICKS),
      landing("c", 300, ON_TIME_TICKS + 1),
      landing("d", 400),
      landing("e", 500, 0, "a2"),
      landing("f", 10, 999),
    ];
    const all = onTimePerformance(timeline, { sinceTick: 50 });
    expect(all).toMatchObject({ flights: 4, onTime: 3, rate: 0.75 });
    const one = onTimePerformance(timeline, { sinceTick: 50, aircraftId: "a1" });
    expect(one?.flights).toBe(3);
    expect(onTimePerformance([landing("x", 1)], { sinceTick: 0 })).toBeNull();
  });
});
