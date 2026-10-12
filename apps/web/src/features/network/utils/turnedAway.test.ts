import type { TimelineEvent } from "@acars/core";
import { TICKS_PER_HOUR } from "@acars/core";
import { describe, expect, it } from "vitest";
import { turnedAwayAt } from "./turnedAway";

const now = 1_000_000;
const landing = (hoursAgo: number, from: string, to: string, pax: number, spilled: number) =>
  ({
    id: `${from}-${to}-${hoursAgo}`,
    tick: now - hoursAgo * TICKS_PER_HOUR,
    timestamp: 0,
    type: "landing",
    description: "",
    originIata: from,
    destinationIata: to,
    details: {
      passengers: { economy: pax, business: 0, first: 0, total: pax },
      spilledPassengers: spilled,
    },
  }) as TimelineEvent;

describe("turnedAwayAt (S63)", () => {
  it("counts departures from the airport in the last 24 h, by destination", () => {
    expect(
      turnedAwayAt(
        [
          landing(2, "MAD", "BCN", 70, 20),
          landing(5, "MAD", "LIS", 60, 8),
          landing(9, "MAD", "BCN", 70, 4),
          landing(3, "BCN", "MAD", 70, 30),
          landing(30, "MAD", "BCN", 70, 99),
        ],
        "MAD",
        now,
      ),
    ).toEqual({
      boarded: 200,
      turnedAway: 32,
      byDestination: [
        { iata: "BCN", count: 24 },
        { iata: "LIS", count: 8 },
      ],
    });
  });
});
