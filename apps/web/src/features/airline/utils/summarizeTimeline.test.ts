import type { TimelineEvent } from "@acars/core";
import { fp, fpToNumber } from "@acars/core";
import { describe, expect, it } from "vitest";
import { summarizeTimeline } from "./summarizeTimeline";

let seq = 0;
function event(
  partial: Partial<TimelineEvent> & Pick<TimelineEvent, "type" | "tick">,
): TimelineEvent {
  seq += 1;
  return { id: `evt-${seq}`, timestamp: 0, description: "", ...partial };
}

function landing(
  tick: number,
  routeId: string,
  od: [string, string],
  revenue: number,
  cost: number,
  pax: number,
) {
  return event({
    type: "landing",
    tick,
    routeId,
    originIata: od[0],
    destinationIata: od[1],
    revenue: fp(revenue),
    cost: fp(cost),
    profit: fp(revenue - cost),
    details: { passengers: { economy: pax, business: 0, first: 0, total: pax } },
  });
}

describe("summarizeTimeline", () => {
  const timeline: TimelineEvent[] = [
    // Newest first, like the store.
    event({ type: "tier_upgrade", tick: 190, id: "evt-tier-up-2-190", description: "Tier 2" }),
    landing(180, "r1", ["MAD", "BCN"], 20_000, 12_000, 70),
    landing(170, "r2", ["MAD", "LIS"], 9_000, 11_000, 30),
    event({ type: "lease_payment", tick: 160, cost: fp(3_000) }),
    event({
      type: "maintenance",
      tick: 150,
      id: "evt-grounded-ac9-150",
      aircraftId: "ac9",
      aircraftName: "EC-AAA",
    }),
    event({
      type: "maintenance",
      tick: 151,
      id: "evt-grounded-ac9-151",
      aircraftId: "ac9",
      aircraftName: "EC-AAA",
    }),
    event({ type: "maintenance", tick: 152, id: "evt-maint-complete-ac3-152", aircraftId: "ac3" }),
    event({
      type: "price_war",
      tick: 140,
      description: "[PRICE WAR] Extreme undercutting on MAD-LIS is damaging your brand reputation.",
    }),
    landing(130, "r1", ["BCN", "MAD"], 18_000, 12_000, 64),
    event({ type: "delivery", tick: 120 }),
    event({ type: "takeoff", tick: 110 }),
    // Outside the window.
    landing(100, "r1", ["MAD", "BCN"], 99_000, 1_000, 99),
    landing(250, "r1", ["MAD", "BCN"], 99_000, 1_000, 99),
  ];

  it("totals flights, passengers and money in the window only", () => {
    const summary = summarizeTimeline(timeline, 100, 200);
    expect(summary.flights).toBe(3);
    expect(summary.passengers).toBe(164);
    expect(fpToNumber(summary.revenue)).toBe(47_000);
    expect(fpToNumber(summary.costs)).toBe(38_000);
    expect(fpToNumber(summary.leasePayments)).toBe(3_000);
    expect(fpToNumber(summary.profit)).toBe(9_000);
  });

  it("ranks routes by profit across both directions", () => {
    const summary = summarizeTimeline(timeline, 100, 200);
    expect(summary.bestRoute).toMatchObject({ routeId: "r1", flights: 2, passengers: 134 });
    expect(fpToNumber(summary.bestRoute?.profit ?? fp(0))).toBe(14_000);
    expect(summary.worstRoute).toMatchObject({
      routeId: "r2",
      originIata: "MAD",
      destinationIata: "LIS",
    });
    expect(fpToNumber(summary.worstRoute?.profit ?? fp(0))).toBe(-2_000);
  });

  it("reports groundings once per aircraft, promotions, deliveries and price wars", () => {
    const summary = summarizeTimeline(timeline, 100, 200);
    expect(summary.groundedAircraft).toEqual([{ id: "ac9", name: "EC-AAA" }]);
    expect(summary.newTier).toBe(2);
    expect(summary.deliveries).toBe(1);
    expect(summary.priceWarRoutes).toEqual(["MAD-LIS"]);
    expect(summary.bankrupt).toBe(false);
    expect(summary.complete).toBe(true);
  });

  it("has no worst route when only one route flew", () => {
    const summary = summarizeTimeline([landing(10, "r1", ["MAD", "BCN"], 1, 0, 1)], 0, 20);
    expect(summary.bestRoute?.routeId).toBe("r1");
    expect(summary.worstRoute).toBeNull();
  });

  it("is empty for a quiet window", () => {
    const summary = summarizeTimeline(timeline, 300, 400);
    expect(summary.flights).toBe(0);
    expect(fpToNumber(summary.profit)).toBe(0);
    expect(summary.bestRoute).toBeNull();
  });

  it("flags a window the capped timeline no longer fully covers", () => {
    const capped = [
      landing(500, "r1", ["MAD", "BCN"], 1, 0, 1),
      landing(400, "r1", ["BCN", "MAD"], 1, 0, 1),
    ];
    const summary = summarizeTimeline(capped, 100, 600, 2);
    expect(summary.complete).toBe(false);
    expect(summary.coveredFromTick).toBe(400);
    // An event older than the window survives, so nothing in the window was dropped.
    expect(summarizeTimeline(capped, 450, 600, 2).complete).toBe(true);
    expect(summarizeTimeline(capped, 400, 600, 2).complete).toBe(true);
    expect(summarizeTimeline(capped, 100, 600, 3).complete).toBe(true);
  });

  it("detects bankruptcy", () => {
    expect(summarizeTimeline([event({ type: "bankruptcy", tick: 5 })], 0, 10).bankrupt).toBe(true);
  });
});
