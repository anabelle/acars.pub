import { act, cleanup, render, screen } from "@testing-library/react";
import { Profiler, useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { Ticker } from "@/features/network/components/Ticker";

/**
 * Selector-granularity smoke test: a minimal external store (semantics of
 * zustand's selector subscriptions via useSyncExternalStore) drives Ticker.
 * Updates to store slices the component does NOT select must not re-render
 * it; updates to selected slices must.
 */

type AirlineState = {
  competitors: Map<string, unknown>;
  fleetByOwner: Map<string, unknown[]>;
  routesByOwner: Map<string, unknown[]>;
  timeline: unknown[];
};
type EngineState = {
  routes: Array<{ season: string }>;
  tick: number;
  homeAirport: { iata: string } | null;
  tickProgress: number;
  catchupProgress: unknown;
};

let airlineState: AirlineState;
let engineState: EngineState;
const airlineListeners = new Set<() => void>();
const engineListeners = new Set<() => void>();

const setAirlineState = (partial: Partial<AirlineState>) => {
  airlineState = { ...airlineState, ...partial };
  airlineListeners.forEach((listener) => listener());
};
const setEngineState = (partial: Partial<EngineState>) => {
  engineState = { ...engineState, ...partial };
  engineListeners.forEach((listener) => listener());
};

vi.mock("@acars/store", () => {
  const useAirlineStore = (selector: (state: AirlineState) => unknown) =>
    useSyncExternalStore(
      (notify: () => void) => {
        airlineListeners.add(notify);
        return () => airlineListeners.delete(notify);
      },
      () => selector(airlineState),
    );
  const useEngineStore = (selector: (state: EngineState) => unknown) =>
    useSyncExternalStore(
      (notify: () => void) => {
        engineListeners.add(notify);
        return () => engineListeners.delete(notify);
      },
      () => selector(engineState),
    );
  return { useAirlineStore, useEngineStore };
});

vi.mock("@acars/data", () => ({
  airports: [],
}));

describe("Ticker selector granularity", () => {
  let renderCount: number;

  beforeEach(() => {
    airlineState = {
      competitors: new Map([["comp1", {}]]),
      fleetByOwner: new Map([
        ["pk1", [{ id: "a1" }, { id: "a2" }]],
        ["comp1", [{ id: "a3" }, { id: "a4" }]],
      ]),
      routesByOwner: new Map([
        ["pk1", [{ id: "r1" }]],
        ["comp1", [{ id: "r2" }, { id: "r3" }]],
      ]),
      timeline: [],
    };
    engineState = {
      routes: [{ season: "summer" }],
      tick: 100,
      homeAirport: { iata: "JFK" },
      tickProgress: 0.5,
      catchupProgress: null,
    };
    renderCount = 0;
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  const onRender = () => {
    renderCount += 1;
  };

  it("shows memoized world totals derived from fleetByOwner/routesByOwner", () => {
    render(
      <Profiler id="ticker" onRender={onRender}>
        <Ticker />
      </Profiler>,
    );
    // 2 + 2 aircraft across owners, 1 + 2 routes, 1 + 1 airlines.
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not re-render on unrelated airline-store updates (fine selectors)", () => {
    render(
      <Profiler id="ticker" onRender={onRender}>
        <Ticker />
      </Profiler>,
    );
    const initialCount = renderCount;
    expect(initialCount).toBeGreaterThan(0);

    // Unrelated slice write: timeline grows every landing — Ticker must not care.
    act(() => {
      setAirlineState({ timeline: [{ id: "evt-1" }] });
    });
    expect(renderCount).toBe(initialCount);

    // World map replaced with an equal-size copy: selected references change,
    // so a re-render is expected (and totals stay correct).
    act(() => {
      setAirlineState({
        fleetByOwner: new Map([
          ["pk1", [{ id: "a1" }, { id: "a2" }]],
          ["comp1", [{ id: "a3" }, { id: "a4" }]],
        ]),
      });
    });
    expect(renderCount).toBe(initialCount + 1);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("re-renders when a selected engine slice (tick) changes", () => {
    render(
      <Profiler id="ticker" onRender={onRender}>
        <Ticker />
      </Profiler>,
    );
    const initialCount = renderCount;

    act(() => {
      setEngineState({ tick: 101 });
    });
    expect(renderCount).toBe(initialCount + 1);
  });
});
