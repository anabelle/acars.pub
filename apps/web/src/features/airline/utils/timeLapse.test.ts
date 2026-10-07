import type { AircraftInstance, TimelineEvent } from "@acars/core";
import { TICK_DURATION, TICKS_PER_HOUR } from "@acars/core";
import { describe, expect, it } from "vitest";
import {
  buildTimeLapse,
  legsInAir,
  replayFleet,
  replayLegs,
  TIME_LAPSE_MAX_MS,
  TIME_LAPSE_MIN_SPEED,
  timeLapseTick,
} from "./timeLapse";

const landing = (
  id: string,
  tick: number,
  durationTicks: number | undefined,
  overrides: Partial<TimelineEvent> = {},
): TimelineEvent =>
  ({
    id,
    tick,
    timestamp: 0,
    type: "landing",
    description: "",
    aircraftId: `ac-${id}`,
    originIata: "MAD",
    destinationIata: "BCN",
    details: durationTicks === undefined ? undefined : { flightDurationTicks: durationTicks },
    ...overrides,
  }) as TimelineEvent;

const HOUR = TICKS_PER_HOUR;

describe("replayLegs()", () => {
  it("rebuilds each landing in the window as a leg, sorted by departure", () => {
    const legs = replayLegs(
      [landing("b", 10 * HOUR, 2 * HOUR), landing("a", 9 * HOUR, 4 * HOUR)],
      0,
      12 * HOUR,
    );
    expect(legs).toEqual([
      {
        id: "a",
        aircraftId: "ac-a",
        originIata: "MAD",
        destinationIata: "BCN",
        departureTick: 5 * HOUR,
        arrivalTick: 9 * HOUR,
      },
      expect.objectContaining({ id: "b", departureTick: 8 * HOUR, arrivalTick: 10 * HOUR }),
    ]);
  });

  it("skips other events, landings outside the window and legs it can't place", () => {
    const legs = replayLegs(
      [
        landing("before", 1 * HOUR, HOUR),
        landing("after", 20 * HOUR, HOUR),
        landing("ferry", 5 * HOUR, HOUR, { type: "ferry" }),
        landing("no-duration", 5 * HOUR, undefined),
        landing("no-origin", 5 * HOUR, HOUR, { originIata: undefined }),
        landing("ok", 5 * HOUR, HOUR),
      ],
      1 * HOUR,
      12 * HOUR,
    );
    expect(legs.map((leg) => leg.id)).toEqual(["ok"]);
  });
});

describe("buildTimeLapse()", () => {
  it("is null when nothing flew", () => {
    expect(buildTimeLapse([], 0, 10 * HOUR)).toBeNull();
  });

  it("spans first departure to last landing, at most 30 s whatever the absence", () => {
    const lapse = buildTimeLapse(
      [landing("a", 4 * HOUR, 2 * HOUR), landing("b", 10 * HOUR, 3 * HOUR)],
      0,
      12 * HOUR,
    );
    expect(lapse?.startTick).toBe(2 * HOUR);
    expect(lapse?.endTick).toBe(10 * HOUR);
    // 8 hours in 30 s: 960×.
    expect(lapse?.durationMs).toBeCloseTo(TIME_LAPSE_MAX_MS);
    expect(lapse?.speed).toBeCloseTo((8 * 3_600_000) / TIME_LAPSE_MAX_MS);
  });

  it("plays short absences at 60×", () => {
    const lapse = buildTimeLapse([landing("a", 2 * HOUR, HOUR / 4)], HOUR, 3 * HOUR);
    expect(lapse?.speed).toBe(TIME_LAPSE_MIN_SPEED);
    expect(lapse?.durationMs).toBeCloseTo(15_000); // 15 minutes at 60×
  });

  it("starts at the absence for flights already in the air", () => {
    const lapse = buildTimeLapse([landing("a", 5 * HOUR, 4 * HOUR)], 3 * HOUR, 6 * HOUR);
    expect(lapse?.startTick).toBe(3 * HOUR);
  });
});

describe("replay clock and planes", () => {
  const lapse = buildTimeLapse(
    [landing("a", 4 * HOUR, 2 * HOUR), landing("b", 10 * HOUR, 3 * HOUR)],
    0,
    12 * HOUR,
  );
  if (!lapse) throw new Error("expected a time-lapse");

  it("maps elapsed real time to replayed ticks, clamped", () => {
    expect(timeLapseTick(lapse, -5)).toBe(lapse.startTick);
    expect(timeLapseTick(lapse, 1_000)).toBeCloseTo(
      lapse.startTick + (1_000 * lapse.speed) / TICK_DURATION,
    );
    expect(timeLapseTick(lapse, lapse.durationMs * 2)).toBe(lapse.endTick);
  });

  it("has only the departed, not yet landed legs in the air", () => {
    expect(legsInAir(lapse, 3 * HOUR)).toEqual([0]);
    expect(legsInAir(lapse, 5 * HOUR)).toEqual([]);
    expect(legsInAir(lapse, 7 * HOUR)).toEqual([1]);
    expect(legsInAir(lapse, 10 * HOUR)).toEqual([]);
  });

  it("flies the real aircraft (or a stand-in) on the replayed leg", () => {
    const real = { id: "ac-a", modelId: "a320neo", status: "idle", flight: null };
    const other = { id: "ac-z", modelId: "b738", status: "idle", flight: null };
    const fleetById = new Map([["ac-a", real as unknown as AircraftInstance]]);
    const planes = replayFleet(lapse, [0, 1], fleetById, other as unknown as AircraftInstance);
    expect(planes.map((plane) => [plane.id, plane.modelId, plane.status])).toEqual([
      ["replay-a", "a320neo", "enroute"],
      ["replay-b", "b738", "enroute"],
    ]);
    expect(planes[0].flight).toEqual(
      expect.objectContaining({ departureTick: 2 * HOUR, arrivalTick: 4 * HOUR }),
    );
    expect(replayFleet(lapse, [0, 1], new Map(), undefined)).toEqual([]);
  });
});
