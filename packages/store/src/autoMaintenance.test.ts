import type { MaintenancePolicy, TimelineEvent } from "@acars/core";
import { fp, fpSum, fpToNumber, TICKS_PER_HOUR } from "@acars/core";
import { setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { beforeAll, describe, expect, it } from "vitest";
import { processFlightEngine } from "./FlightEngine.js";
import { initState, makeAircraft, makeRoute } from "./testing/engineFixtures.js";

beforeAll(() => {
  setAirportsCatalog(airports);
});

const DAYS = 90;
const STEP = TICKS_PER_HOUR / 2; // 30 game minutes: the engine handles the jumps.

/** Flies one ATR 72 on MAD–BCN for 90 days with the given fleet policy. */
function simulateAbsence(fleetPolicy?: MaintenancePolicy, hubs: string[] = ["MAD", "BCN"]) {
  const route = makeRoute({
    id: "r-mad-bcn",
    originIata: "MAD",
    destinationIata: "BCN",
    distanceKm: 483,
    assignedAircraftIds: ["ac-1"],
    frequencyPerWeek: 70,
  });
  const aircraft = makeAircraft({
    id: "ac-1",
    modelId: "atr72-600",
    assignedRouteId: route.id,
    baseAirportIata: "MAD",
  });
  let state = initState([aircraft], [route], fp(500_000_000));
  const events: TimelineEvent[] = [];
  for (let tick = STEP; tick <= DAYS * 24 * TICKS_PER_HOUR; tick += STEP) {
    const result = processFlightEngine(
      tick,
      state.fleet,
      state.routes,
      state.balance,
      state.lastTick,
      new Map(),
      "player",
      0.5,
      Number.POSITIVE_INFINITY,
      { fleetPolicy, hubs },
    );
    events.push(...result.events);
    state = {
      ...state,
      fleet: result.updatedFleet,
      balance: result.corporateBalance,
      lastTick: tick,
    };
  }
  const grounded = events.filter((e) => e.description.includes("GROUNDED"));
  const services = events.filter((e) => e.id.startsWith("evt-automaint-"));
  return { state, events, grounded, services };
}

const POLICY: MaintenancePolicy = { enabled: true, minCondition: 0.4, hubOnly: false };

type Run = ReturnType<typeof simulateAbsence>;
const runs = {} as { none: Run; policy: Run; replay: Run; hubOnly: Run };

describe("auto-maintenance over a 90-day absence (S13)", () => {
  // Each run steps ~4,300 ticks; computed once (slow under coverage).
  beforeAll(() => {
    runs.none = simulateAbsence();
    runs.policy = simulateAbsence(POLICY);
    runs.replay = simulateAbsence(POLICY);
    runs.hubOnly = simulateAbsence({ ...POLICY, hubOnly: true }, ["MAD"]);
  }, 120_000);

  it("without a policy the aircraft hits the hours limit and grounds", () => {
    const run = runs.none;
    expect(run.grounded.length).toBeGreaterThan(0);
    expect(run.services).toHaveLength(0);
  });

  it("with a policy it is serviced on time and never grounds", () => {
    const run = runs.policy;
    expect(run.grounded).toHaveLength(0);
    expect(run.services.length).toBeGreaterThan(0);
    const aircraft = run.state.fleet[0];
    expect(aircraft.flightHoursSinceCheck).toBeLessThan(600);
    for (const service of run.services) {
      expect(fpToNumber(service.cost ?? fp(0))).toBeGreaterThanOrEqual(15_000);
    }
  });

  it("charges identically on replay", () => {
    const a = runs.policy;
    const b = runs.replay;
    expect(b.state.balance).toBe(a.state.balance);
    expect(b.services.map((e) => [e.tick, e.cost])).toEqual(
      a.services.map((e) => [e.tick, e.cost]),
    );
    expect(fpSum(a.services.map((e) => e.cost ?? fp(0)))).toBeGreaterThan(0);
  });

  it("hub-only services happen only at a hub", () => {
    const run = runs.hubOnly;
    expect(run.grounded).toHaveLength(0);
    expect(run.services.length).toBeGreaterThan(0);
    // Each service starts with the aircraft based at MAD (it then stays put).
    const takeoffsAfterService = run.services.map((service) =>
      run.events.find((e) => e.type === "takeoff" && e.tick > service.tick),
    );
    for (const takeoff of takeoffsAfterService) {
      if (takeoff) expect(takeoff.originIata).toBe("MAD");
    }
  });

  it("does not service when the airline cannot pay", () => {
    const route = makeRoute({ id: "r1", assignedAircraftIds: ["ac-1"] });
    const aircraft = makeAircraft({
      id: "ac-1",
      assignedRouteId: "r1",
      baseAirportIata: route.originIata,
      condition: 0.3,
    });
    const result = processFlightEngine(
      1,
      [aircraft],
      [route],
      fp(10),
      0,
      new Map(),
      "p",
      0.5,
      Infinity,
      {
        fleetPolicy: POLICY,
        hubs: [route.originIata],
      },
    );
    expect(result.events.some((e) => e.id.startsWith("evt-automaint-"))).toBe(false);
    expect(result.corporateBalance).toBe(fp(10));
  });

  it("prefers the aircraft's own policy over the fleet default", () => {
    const route = makeRoute({ id: "r1", assignedAircraftIds: ["ac-1"] });
    const aircraft = makeAircraft({
      id: "ac-1",
      assignedRouteId: "r1",
      baseAirportIata: route.originIata,
      condition: 0.3,
      maintenancePolicy: { enabled: false, minCondition: 0.4, hubOnly: false },
    });
    const result = processFlightEngine(
      1,
      [aircraft],
      [route],
      fp(1e9),
      0,
      new Map(),
      "p",
      0.5,
      Infinity,
      {
        fleetPolicy: POLICY,
        hubs: [route.originIata],
      },
    );
    expect(result.events.some((e) => e.id.startsWith("evt-automaint-"))).toBe(false);
  });
});
