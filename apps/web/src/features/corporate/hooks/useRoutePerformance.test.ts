import type { Route, TimelineEvent } from "@acars/core";
import { fp, fpToNumber } from "@acars/core";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRoutePerformance } from "./useRoutePerformance";

describe("useRoutePerformance", () => {
  it("uses total flight durations for profit per hour", () => {
    const routes: Route[] = [
      {
        id: "route-1",
        originIata: "JFK",
        destinationIata: "LAX",
        airlinePubkey: "pub",
        distanceKm: 4000,
        assignedAircraftIds: ["ac-1"],
        fareEconomy: fp(100),
        fareBusiness: fp(200),
        fareFirst: fp(300),
        status: "active",
      },
    ];
    const timeline: TimelineEvent[] = [
      {
        id: "evt-1",
        tick: 100,
        timestamp: 0,
        type: "landing",
        description: "Landing 1",
        profit: fp(2000),
        details: {
          loadFactor: 0.7,
          routeId: "route-1",
          flightDurationTicks: 600,
        },
      },
      {
        id: "evt-2",
        tick: 100,
        timestamp: 0,
        type: "landing",
        description: "Landing 2",
        profit: fp(1000),
        details: {
          loadFactor: 0.8,
          routeId: "route-1",
          flightDurationTicks: 600,
        },
      },
    ];

    const { result } = renderHook(() => useRoutePerformance(timeline, routes));

    expect(result.current).toHaveLength(1);
    expect(fpToNumber(result.current[0]?.profitPerHour ?? fp(0))).toBeCloseTo(3000, 5);
    expect(result.current[0]?.avgLoadFactor).toBeCloseTo(0.75, 5);
  });
});
