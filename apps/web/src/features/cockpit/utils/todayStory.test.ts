import type { TimelineEvent } from "@acars/core";
import { fp, TICKS_PER_HOUR } from "@acars/core";
import { describe, expect, it } from "vitest";
import { buildTodayStory } from "./todayStory";

const H = TICKS_PER_HOUR;
const now = 1_000_000;
const ev = (over: Partial<TimelineEvent> & { hoursAgo: number }) => {
  const { hoursAgo, ...rest } = over;
  return {
    id: `e-${hoursAgo}-${rest.type}`,
    tick: now - hoursAgo * H,
    timestamp: 0,
    description: "",
    ...rest,
  } as TimelineEvent;
};
const landing = (hoursAgo: number, profit: number, pax: number, spilled = 0, aircraftId = "q") =>
  ev({
    hoursAgo,
    type: "landing",
    aircraftId,
    routeId: "r1",
    originIata: "PTY",
    destinationIata: "SJO",
    profit: fp(profit),
    details: {
      passengers: { economy: pax, business: 0, first: 0, total: pax },
      spilledPassengers: spilled,
    },
  });
const fleet = [
  { id: "q", name: "Quetzal", status: "enroute", assignedRouteId: "r1", baseAirportIata: "PTY" },
  { id: "m", name: "Mariposa", status: "idle", assignedRouteId: null, baseAirportIata: "PTY" },
] as never[];
const routes = [{ id: "r1", originIata: "PTY", destinationIata: "SJO" }];

describe("buildTodayStory (S62)", () => {
  it("tells the last 24 hours in order and ends with what needs the player", () => {
    const story = buildTodayStory({
      timeline: [
        ev({ hoursAgo: 9, type: "delivery", aircraftId: "q", destinationIata: "PTY" }),
        landing(6, 1_200, 64, 20),
        landing(3, 800, 70, 8),
        landing(30, 9_999, 99),
      ],
      fleet,
      routes,
      tick: now,
    });
    expect(story.earned).toBe(fp(2_000));
    expect(story.passengers).toBe(134);
    expect(story.landings).toBe(2);
    expect(story.chapters.map((c) => c.kind)).toEqual([
      "delivery",
      "bestFlight",
      "turnedAway",
      "parked",
    ]);
    expect(story.chapters[1]).toMatchObject({ name: "Quetzal", passengers: 64, profit: fp(1_200) });
    expect(story.chapters[2]).toMatchObject({ turnedAway: 28, boarded: 134, destination: "SJO" });
    expect(story.chapters[3]).toMatchObject({ name: "Mariposa", others: 0 });
  });

  it("leaves out small spills, losing flights and other airlines' deliveries", () => {
    const story = buildTodayStory({
      timeline: [
        ev({ hoursAgo: 2, type: "delivery", aircraftId: "rival" }),
        landing(1, -50, 30, 4),
      ],
      fleet: [fleet[0]],
      routes,
      tick: now,
    });
    expect(story.chapters).toEqual([]);
  });
});
