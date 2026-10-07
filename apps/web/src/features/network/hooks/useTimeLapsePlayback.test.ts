import type { AircraftInstance } from "@acars/core";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimeLapse } from "@/features/airline/utils/timeLapse";

const state = vi.hoisted(() => ({ stopTimeLapse: vi.fn() }));
vi.mock("@/features/airline/lib/timeLapseState", () => state);

import { useTimeLapsePlayback } from "./useTimeLapsePlayback";

// Two legs over 2,700 ticks (2 h 15 min), played in 27 s: 100 ticks a second.
const lapse: TimeLapse = {
  legs: [
    {
      id: "a",
      aircraftId: "ac1",
      originIata: "MAD",
      destinationIata: "BCN",
      departureTick: 0,
      arrivalTick: 1_200,
    },
    {
      id: "b",
      aircraftId: "ac1",
      originIata: "BCN",
      destinationIata: "MAD",
      departureTick: 1_500,
      arrivalTick: 2_700,
    },
  ],
  startTick: 0,
  endTick: 2_700,
  speed: 300,
  durationMs: 27_000,
};
const fleet = [
  { id: "ac1", modelId: "a320neo", status: "idle", flight: null },
] as unknown as AircraftInstance[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
});

afterEach(() => {
  vi.useRealTimers();
  state.stopTimeLapse.mockClear();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useTimeLapsePlayback()", () => {
  it("is off without a time-lapse", () => {
    const { result } = renderHook(() => useTimeLapsePlayback(null, fleet));
    expect(result.current).toBeNull();
  });

  it("runs the replay clock and flies the legs in the air, then stops", () => {
    const { result } = renderHook(() => useTimeLapsePlayback(lapse, fleet));
    advance(1_000);
    expect(result.current?.clock.current.tick).toBeGreaterThan(90);
    expect(result.current?.fleet.map((plane) => plane.id)).toEqual(["replay-a"]);

    // 13 s in: tick 1,300, between the two legs.
    advance(12_000);
    expect(result.current?.fleet).toEqual([]);

    // 20 s in: the return leg is flying.
    advance(7_000);
    expect(result.current?.fleet.map((plane) => plane.id)).toEqual(["replay-b"]);
    expect(result.current?.elapsed.current).toBeGreaterThan(19_000);

    // Past the end plus the hold: the map is handed back.
    advance(10_000);
    expect(state.stopTimeLapse).toHaveBeenCalledTimes(1);
  });
});
