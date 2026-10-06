import { fp, TICKS_PER_HOUR, type TimelineEvent } from "@acars/core";
import { BURST_POOL_SIZE } from "@acars/map";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useLandingBursts } from "./useLandingBursts";

const lookup = () => ({ latitude: 1, longitude: 2 });
const landing = (id: string): TimelineEvent => ({
  id,
  tick: 1,
  timestamp: 1,
  type: "landing",
  description: "",
  destinationIata: "JFK",
  profit: fp(1000),
});

const initialAirline = useAirlineStore.getState();
const initialEngine = useEngineStore.getState();

/** Prepends events and advances the airline's clock by `ticks`. */
function addEvents(events: TimelineEvent[], ticks = 3) {
  act(() => {
    useAirlineStore.setState(
      (state) =>
        ({
          timeline: [...events, ...state.timeline],
          airline: {
            ...(state.airline as object),
            lastTick: (state.airline?.lastTick ?? 0) + ticks,
          },
        }) as never,
    );
  });
}

beforeEach(() => {
  useAirlineStore.setState({ timeline: [landing("old")], airline: { lastTick: 100 } } as never);
  useEngineStore.setState({ catchupProgress: null } as never);
});

afterEach(() => {
  useAirlineStore.setState(initialAirline, true);
  useEngineStore.setState(initialEngine, true);
});

describe("useLandingBursts()", () => {
  it("emits new landings only, oldest first", () => {
    const { result } = renderHook(() => useLandingBursts(lookup));
    expect(result.current).toEqual([]);
    addEvents([landing("b"), landing("a")]);
    expect(result.current.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("keeps at most one pool's worth", () => {
    const { result } = renderHook(() => useLandingBursts(lookup));
    for (let i = 0; i < BURST_POOL_SIZE + 3; i++) addEvents([landing(`l${i}`)]);
    expect(result.current).toHaveLength(BURST_POOL_SIZE);
    expect(result.current[result.current.length - 1]?.id).toBe(`l${BURST_POOL_SIZE + 2}`);
  });

  it("skips catch-ups (long jumps or a running catch-up)", () => {
    const { result } = renderHook(() => useLandingBursts(lookup));
    addEvents([landing("away")], TICKS_PER_HOUR);
    act(() => useEngineStore.setState({ catchupProgress: { done: 1, total: 2 } } as never));
    addEvents([landing("during")]);
    act(() => useEngineStore.setState({ catchupProgress: null } as never));
    expect(result.current).toEqual([]);
    addEvents([landing("live")]);
    expect(result.current.map((b) => b.id)).toEqual(["live"]);
  });

  it("ignores updates that don't touch the timeline", () => {
    const { result } = renderHook(() => useLandingBursts(lookup));
    act(() => useAirlineStore.setState({ fleet: [] } as never));
    expect(result.current).toEqual([]);
  });
});
