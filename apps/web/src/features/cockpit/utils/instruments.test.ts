import type { TimelineEvent } from "@acars/core";
import { fp, TICKS_PER_HOUR } from "@acars/core";
import { describe, expect, it } from "vitest";
import { computeInstruments } from "./instruments";

const H = TICKS_PER_HOUR;
const now = 1_000_000;
const landing = (hoursAgo: number, hours: number, lf: number, revenue: number, profit: number) =>
  ({
    id: `l-${hoursAgo}`,
    tick: now - hoursAgo * H,
    timestamp: 0,
    type: "landing",
    description: "",
    aircraftId: "a",
    revenue: fp(revenue),
    profit: fp(profit),
    details: { flightDurationTicks: hours * H, loadFactor: lf },
  }) as TimelineEvent;

const fleet = [
  { status: "enroute", purchasedAtTick: 0 },
  { status: "idle", purchasedAtTick: 0 },
  { status: "delivery", purchasedAtTick: now },
] as never[];
const run = (timeline: TimelineEvent[], fixed = 0, balance = 1_000_000) =>
  Object.fromEntries(
    computeInstruments({
      timeline,
      fleet,
      tick: now,
      balance: fp(balance),
      fixedCostsPerDay: fp(fixed),
    }).map((i) => [i.id, i]),
  );

describe("computeInstruments (S62)", () => {
  it("reads utilization per delivered plane, load factor and margin over 24 h", () => {
    const i = run([
      landing(2, 10, 0.8, 10_000, 1_500),
      landing(5, 10, 0.9, 10_000, 1_500),
      landing(30, 4, 0.5, 10_000, -500),
    ]);
    expect(i.utilization.value).toBe(10); // 20 block h over 2 planes
    expect(i.utilization.state).toBe("normal");
    expect(i.utilization.previous).toBe(2);
    expect(i.loadFactor.value).toBeCloseTo(0.85);
    expect(i.loadFactor.state).toBe("normal");
    expect(i.margin.value).toBeCloseTo(0.15);
    expect(i.margin.previous).toBeCloseTo(-0.05);
    expect(i.runway.value).toBe(Number.POSITIVE_INFINITY);
  });

  it("flags idle planes, empty seats and thin margins", () => {
    const i = run([landing(3, 2, 0.4, 10_000, 200)]);
    expect(i.utilization).toMatchObject({ value: 1, state: "warning", side: "low" });
    expect(i.loadFactor).toMatchObject({ state: "warning", side: "low" });
    expect(i.margin).toMatchObject({ state: "warning", side: "low" });
  });

  it("only cautions when too full or too rich", () => {
    const i = run([landing(3, 2, 0.99, 10_000, 5_000)]);
    expect(i.loadFactor).toMatchObject({ state: "caution", side: "high" });
    expect(i.margin).toMatchObject({ state: "caution", side: "high" });
  });

  it("counts the days of cash left when the airline loses money", () => {
    const i = run([landing(3, 2, 0.8, 10_000, 1_000)], 21_000, 400_000);
    expect(i.runway.value).toBe(20);
    expect(i.runway.state).toBe("caution");
  });

  it("has no readings before the first landing", () => {
    const i = run([]);
    for (const id of ["utilization", "loadFactor", "margin", "runway"]) {
      expect(i[id]).toMatchObject({ value: null, state: "none" });
    }
  });

  it("scales a young airline's flying to a day of its time in service", () => {
    const young = [{ status: "enroute", purchasedAtTick: now - 6 * H }] as never[];
    const [utilization] = computeInstruments({
      timeline: [landing(1, 3, 0.8, 1_000, 100)],
      fleet: young,
      tick: now,
      balance: fp(1_000),
      fixedCostsPerDay: fp(0),
    });
    expect(utilization.value).toBe(12); // 3 h in 6 h of service → 12 h a day
    expect(utilization.state).toBe("normal");
  });
});
