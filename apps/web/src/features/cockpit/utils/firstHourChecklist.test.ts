import { fp, fpAdd, getSuggestedFares } from "@acars/core";
import { describe, expect, it } from "vitest";
import { type ChecklistInput, deriveFirstHourChecklist } from "./firstHourChecklist";

const route = (distanceKm = 483, overrides: Partial<ChecklistInput["routes"][number]> = {}) => {
  const fares = getSuggestedFares(distanceKm);
  return {
    distanceKm,
    fareEconomy: fares.economy,
    fareBusiness: fares.business,
    fareFirst: fares.first,
    status: "active" as const,
    ...overrides,
  };
};
const parked = { status: "idle" as const, flight: null, assignedRouteId: null };
const flying = { status: "enroute" as const, flight: {} as never, assignedRouteId: "r1" };

const derive = (input: Partial<ChecklistInput>) =>
  deriveFirstHourChecklist({ routes: [], fleet: [], cumulativeRevenue: fp(0), ...input });
const doneIds = (input: Partial<ChecklistInput>) =>
  derive(input)
    .steps.filter((step) => step.done)
    .map((step) => step.id);

describe("deriveFirstHourChecklist", () => {
  it("starts with opening a route", () => {
    const checklist = derive({ fleet: [parked] });
    expect(checklist.doneCount).toBe(0);
    expect(checklist.next).toMatchObject({
      id: "openRoute",
      to: "/network",
      search: { tab: "opportunities" },
    });
    expect(checklist.complete).toBe(false);
  });

  it("moves to the first takeoff once a route is open", () => {
    const checklist = derive({ routes: [route()], fleet: [parked] });
    expect(checklist.next).toMatchObject({ id: "firstTakeoff", to: "/fleet" });
  });

  it("marks the takeoff as waiting once an aircraft is assigned", () => {
    const assigned = { status: "delivery" as const, flight: null, assignedRouteId: "r1" };
    const checklist = derive({ routes: [route()], fleet: [assigned] });
    expect(checklist.next).toMatchObject({ id: "firstTakeoff", waiting: true });
    expect(derive({ routes: [route()], fleet: [parked] }).next).toMatchObject({ waiting: false });
  });

  it("counts an aircraft in the air as the first takeoff", () => {
    expect(doneIds({ routes: [route()], fleet: [flying] })).toEqual(["openRoute", "firstTakeoff"]);
  });

  it("counts revenue or a landing event as the first landing (and takeoff)", () => {
    expect(doneIds({ routes: [route()], fleet: [parked], cumulativeRevenue: fp(5000) })).toEqual([
      "openRoute",
      "firstTakeoff",
      "firstLanding",
    ]);
    expect(
      doneIds({ routes: [route()], fleet: [parked], timeline: [{ type: "landing" }] }),
    ).toContain("firstLanding");
    expect(doneIds({ routes: [route()], timeline: [{ type: "delivery" }] })).not.toContain(
      "firstLanding",
    );
  });

  it("treats a fare other than the suggested one as adjusted", () => {
    const suggested = getSuggestedFares(483);
    expect(doneIds({ routes: [route()] })).not.toContain("adjustFare");
    expect(
      doneIds({ routes: [route(483, { fareEconomy: fpAdd(suggested.economy, fp(10)) })] }),
    ).toContain("adjustFare");
    expect(doneIds({ routes: [route(483, { fareFirst: fp(1) })] })).toContain("adjustFare");
  });

  it("needs three routes that still fly, and completes when all steps are done", () => {
    const three = [route(483, { fareEconomy: fp(1) }), route(600), route(900)];
    expect(
      doneIds({ routes: [...three.slice(0, 2), route(900, { status: "suspended" })] }),
    ).not.toContain("thirdRoute");
    const checklist = derive({ routes: three, fleet: [flying], cumulativeRevenue: fp(1) });
    expect(checklist.complete).toBe(true);
    expect(checklist.next).toBeNull();
    expect(checklist.doneCount).toBe(5);
  });
});
