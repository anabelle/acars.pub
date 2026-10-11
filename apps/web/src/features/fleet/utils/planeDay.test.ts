import type { TimelineEvent } from "@acars/core";
import { fp, TICKS_PER_HOUR } from "@acars/core";
import { describe, expect, it } from "vitest";
import { summarizeFleetDays, topEarnerId } from "./planeDay";

const H = TICKS_PER_HOUR;
const now = 10_000_000;
const dayStart = now - 24 * H;

const landing = (
  aircraftId: string,
  tick: number,
  duration: number,
  profit: number,
): TimelineEvent =>
  ({
    id: `${aircraftId}-${tick}`,
    tick,
    timestamp: 0,
    type: "landing",
    description: "",
    aircraftId,
    profit: fp(profit),
    details: { flightDurationTicks: duration },
  }) as TimelineEvent;

describe("summarizeFleetDays (S60)", () => {
  const fleet = [
    {
      id: "a",
      status: "enroute" as const,
      flight: { departureTick: now - H, arrivalTick: now + H },
    },
    { id: "b", status: "idle" as const, flight: null },
  ] as never[];

  it("collects the last 24 hours of legs, oldest first, including the one in the air", () => {
    const days = summarizeFleetDays(
      fleet,
      [landing("a", dayStart + 8 * H, 2 * H, 100), landing("a", dayStart - 2 * H, H, 50)],
      now,
    );
    expect(days.get("a")?.legs).toEqual([
      { startHour: 6, durationHours: 2 },
      { startHour: 23, durationHours: 1 },
    ]);
    expect(days.get("b")?.legs).toEqual([]);
  });

  it("sums seven days of profit and ignores older landings and other airlines", () => {
    const days = summarizeFleetDays(
      fleet,
      [
        landing("a", now - 3 * 24 * H, H, 100),
        landing("a", now - 8 * 24 * H, H, 1_000),
        landing("b", now - H, H, 250),
        landing("rival", now - H, H, 9_999),
      ],
      now,
    );
    expect(days.get("a")?.profit7d).toBe(fp(100));
    expect(days.get("b")?.profit7d).toBe(fp(250));
    expect(days.has("rival")).toBe(false);
    expect(topEarnerId(days)).toBe("b");
  });

  it("has no top earner when nobody made money", () => {
    const days = summarizeFleetDays(fleet, [landing("a", now - H, H, -50)], now);
    expect(topEarnerId(days)).toBeNull();
  });
});
