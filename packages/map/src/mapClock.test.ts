import { describe, expect, it } from "vitest";
import { ROUTE_FLOW_STEP_MS } from "./layers/routes";
import { initialMapClockState, MAP_CLOCK_MS, planMapClockTick, planWrites } from "./mapClock";

describe("map clock", () => {
  it("steps the route flow once per clock tick (no redraws of its own)", () => {
    expect(ROUTE_FLOW_STEP_MS).toBe(MAP_CLOCK_MS);
  });

  it("writes nothing on an idle map", () => {
    const plan = planMapClockTick(initialMapClockState(), {
      flights: 0,
      globalFlights: 0,
      flowDash: null,
    });
    expect(planWrites(plan)).toBe(false);
  });

  it("uploads flights while aircraft fly, and once more when the last one lands", () => {
    let state = initialMapClockState();
    const tick = (flights: number) => {
      const plan = planMapClockTick(state, { flights, globalFlights: 0, flowDash: null });
      state = plan.next;
      return plan.uploadFlights;
    };
    expect([tick(2), tick(2), tick(0), tick(0)]).toEqual([true, true, true, false]);
  });

  it("tracks rivals' aircraft separately", () => {
    const plan = planMapClockTick(
      { flights: 0, globalFlights: 3, flowKey: null },
      { flights: 0, globalFlights: 0, flowDash: null },
    );
    expect(plan).toMatchObject({ uploadFlights: false, uploadGlobalFlights: true });
  });

  it("applies the flow dash only when its step changes", () => {
    const first = planMapClockTick(initialMapClockState(), {
      flights: 0,
      globalFlights: 0,
      flowDash: [0, 4, 3],
    });
    expect(first.flowDash).toEqual([0, 4, 3]);
    const same = planMapClockTick(first.next, {
      flights: 0,
      globalFlights: 0,
      flowDash: [0, 4, 3],
    });
    expect(planWrites(same)).toBe(false);
    const next = planMapClockTick(same.next, {
      flights: 0,
      globalFlights: 0,
      flowDash: [0.5, 4, 2.5],
    });
    expect(next.flowDash).toEqual([0.5, 4, 2.5]);
  });

  it("keeps the last dash while the flow is paused", () => {
    const shown = planMapClockTick(initialMapClockState(), {
      flights: 0,
      globalFlights: 0,
      flowDash: [1, 4, 2],
    }).next;
    const paused = planMapClockTick(shown, { flights: 0, globalFlights: 0, flowDash: null });
    expect(paused.flowDash).toBeNull();
    expect(paused.next.flowKey).toBe("1,4,2");
  });
});
