import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { AppInitializer } from "./AppInitializer";

const mockUseAirlineStore = vi.hoisted(() => vi.fn());
const mockUseEngineStore = vi.hoisted(() => vi.fn());

type Selector<T> = (state: T) => unknown;
type AirlineStoreState = {
  airline: unknown;
  identityStatus: string;
  initializeIdentity: () => void;
  competitors: Map<string, unknown>;
};
type EngineStoreState = {
  homeAirport: unknown;
  setHub: (...args: unknown[]) => void;
  startEngine: () => void;
};

vi.mock("@acars/store", () => {
  const useAirlineStore = Object.assign(
    (selector?: Selector<AirlineStoreState>) => {
      const state = mockUseAirlineStore() as AirlineStoreState;
      return selector ? selector(state) : state;
    },
    { getState: () => mockUseAirlineStore() as AirlineStoreState },
  );
  const useEngineStore = Object.assign(
    (selector: Selector<EngineStoreState>) => selector(mockUseEngineStore() as EngineStoreState),
    { getState: () => mockUseEngineStore() as EngineStoreState },
  );
  return {
    useAirlineStore,
    useEngineStore,
  };
});

vi.mock("@acars/data", () => {
  return {
    airports: [
      { iata: "JFK", latitude: 0, longitude: 0, timezone: "UTC", city: "City", population: 1 },
    ],
    findPreferredHub: () => ({ iata: "JFK", latitude: 0, longitude: 0 }),
  };
});

describe("AppInitializer", () => {
  const originalGeolocation = navigator.geolocation;

  beforeEach(() => {
    mockUseAirlineStore.mockReturnValue({
      airline: null,
      identityStatus: "ready",
      initializeIdentity: vi.fn(),
      competitors: new Map(),
    });
    mockUseEngineStore.mockReturnValue({
      homeAirport: null,
      setHub: vi.fn(),
      startEngine: vi.fn(),
    });
    (navigator as unknown as { geolocation?: Geolocation }).geolocation = undefined;
  });

  afterEach(() => {
    (navigator as unknown as { geolocation?: Geolocation }).geolocation = originalGeolocation;
    vi.restoreAllMocks();
  });

  it("initializes identity on mount", () => {
    const initializeIdentity = vi.fn();
    mockUseAirlineStore.mockReturnValue({
      airline: null,
      identityStatus: "ready",
      initializeIdentity,
      competitors: new Map(),
    });

    (navigator as unknown as { geolocation?: Geolocation }).geolocation = {
      getCurrentPosition: vi.fn(),
      clearWatch: vi.fn(),
      watchPosition: vi.fn(),
    } as Geolocation;

    render(
      <AppInitializer>
        <div>App</div>
      </AppInitializer>,
    );

    expect(initializeIdentity).toHaveBeenCalled();
  });

  it("falls back to timezone when geolocation unavailable", () => {
    const setHub = vi.fn();
    const startEngine = vi.fn();
    mockUseEngineStore.mockReturnValue({
      homeAirport: null,
      setHub,
      startEngine,
    });
    delete (navigator as unknown as { geolocation?: Geolocation }).geolocation;

    render(
      <AppInitializer>
        <div>App</div>
      </AppInitializer>,
    );

    expect(setHub).toHaveBeenCalled();
    expect(startEngine).toHaveBeenCalled();
  });
});
