import { describe, expect, it } from "vitest";
import { estimateNextService, flightHoursPerDay } from "./nextService";

const model = { speedKmh: 500, blockHoursPerDay: 12 };
const on = { enabled: true, minCondition: 0.4, hubOnly: false };
const off = { ...on, enabled: false };

describe("flightHoursPerDay()", () => {
  it("shares the route's weekly legs across its aircraft, capped by block hours", () => {
    const route = { distanceKm: 500, frequencyPerWeek: 7, assignedAircraftIds: ["a"] };
    expect(flightHoursPerDay(model, route)).toBeCloseTo(2, 10);
    expect(flightHoursPerDay(model, { ...route, assignedAircraftIds: ["a", "b"] })).toBeCloseTo(
      1,
      10,
    );
    expect(flightHoursPerDay(model, { ...route, frequencyPerWeek: 70 })).toBe(12);
    expect(flightHoursPerDay(model, null)).toBe(0);
    expect(
      flightHoursPerDay(
        { speedKmh: 0, blockHoursPerDay: 24 },
        { ...route, frequencyPerWeek: undefined as never, assignedAircraftIds: [] },
      ),
    ).toBeCloseTo((500 / 800) * 2, 10);
  });
});

describe("estimateNextService()", () => {
  it("projects the policy's service from hours (the usual limit)", () => {
    // 540 h limit − 40 h flown = 500 h left; condition allows 10,000 h.
    expect(estimateNextService({ condition: 0.9, flightHoursSinceCheck: 40 }, on, 10)).toEqual({
      kind: "service",
      days: 50,
    });
  });

  it("projects from condition when that comes first", () => {
    // (0.42 − 0.40) / 0.00005 = 400 h.
    expect(estimateNextService({ condition: 0.42, flightHoursSinceCheck: 0 }, on, 10)?.days).toBe(
      40,
    );
  });

  it("without a policy, projects grounding instead", () => {
    expect(estimateNextService({ condition: 1, flightHoursSinceCheck: 0 }, off, 10)).toEqual({
      kind: "grounding",
      days: 60,
    });
  });

  it("is due now when already past, and unknown when not flying", () => {
    expect(estimateNextService({ condition: 0.3, flightHoursSinceCheck: 0 }, on, 5)?.days).toBe(0);
    expect(estimateNextService({ condition: 1, flightHoursSinceCheck: 0 }, on, 0)).toBeNull();
  });
});
