import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { fp, GENESIS_TIME, TICK_DURATION, TICKS_PER_HOUR } from "@acars/core";
import { Ticker } from "./Ticker";

type Selector<T> = (state: T) => unknown;
type EngineStoreState = {
  routes: Array<{ season: string }>;
  tick: number;
  homeAirport: { iata: string } | null;
  tickProgress: number;
  catchupProgress: number | null;
};
type AirlineStoreState = {
  competitors: Map<string, unknown>;
  fleetByOwner: Map<string, unknown[]>;
  routesByOwner: Map<string, unknown[]>;
  airline?: unknown;
  fleet: unknown[];
  routes: unknown[];
  timeline?: unknown[];
};

const mockUseEngineStore = vi.fn();
const mockUseAirlineStore = vi.fn();

vi.mock("@acars/store", () => {
  return {
    useEngineStore: (selector: Selector<EngineStoreState>) =>
      selector(mockUseEngineStore() as EngineStoreState),
    useAirlineStore: (selector: Selector<AirlineStoreState>) =>
      selector(mockUseAirlineStore() as AirlineStoreState),
  };
});

const relayHealth = vi.hoisted(() => ({ status: "ready" as "ready" | "connecting" | "offline" }));
vi.mock("@/shared/hooks/useRelayHealth", () => ({
  useRelayHealth: () => ({
    status: relayHealth.status,
    relayCount: relayHealth.status === "ready" ? 2 : 0,
    isConnected: relayHealth.status === "ready",
    retry: async () => {},
    retrying: false,
  }),
}));

vi.mock("@acars/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@acars/core")>();
  return {
    ...original,
    getProsperityIndex: () => 1.05,
  };
});

vi.mock("@acars/data", () => {
  return {
    airports: new Array(10).fill(null),
  };
});

describe("Ticker", () => {
  afterEach(async () => {
    relayHealth.status = "ready";
    cleanup();
    await i18n.changeLanguage("en");
  });

  it("renders null when no home airport", () => {
    mockUseEngineStore.mockReturnValue({
      routes: [],
      tick: 0,
      homeAirport: null,
      tickProgress: 0,
      catchupProgress: null,
    });
    mockUseAirlineStore.mockReturnValue({
      competitors: new Map(),
      fleetByOwner: new Map(),
      routesByOwner: new Map(),
      fleet: [],
      routes: [],
    });
    const { container } = render(<Ticker />);
    expect(container.firstChild).toBeNull();
  });

  it("renders live metrics when home airport present", () => {
    mockUseEngineStore.mockReturnValue({
      routes: [{ season: "summer" }],
      tick: 10,
      homeAirport: { iata: "JFK" },
      tickProgress: 0.5,
      catchupProgress: null,
    });
    mockUseAirlineStore.mockReturnValue({
      competitors: new Map(),
      fleetByOwner: new Map([
        ["pk1", [{ id: "a1" }, { id: "a2" }, { id: "a3" }]],
        ["pk2", [{ id: "a4" }, { id: "a5" }, { id: "a6" }, { id: "a7" }]],
      ]),
      routesByOwner: new Map([
        ["pk1", [{ id: "r1" }]],
        ["pk2", [{ id: "r2" }, { id: "r3" }]],
      ]),
      fleet: [],
      routes: [],
    });

    render(<Ticker />);
    expect(screen.getByText("Summer")).toBeInTheDocument();
    expect(screen.getByTestId("ticker-live")).toHaveTextContent("Live");
    expect(screen.getByText("World economy")).toBeInTheDocument();
    // Guests see world facts only.
    expect(screen.queryByTestId("ticker-next-landing")).not.toBeInTheDocument();
    // Memoized world totals: 3 + 4 aircraft across owners, 1 + 2 routes.
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders translated season labels in Spanish", async () => {
    await i18n.changeLanguage("es");
    mockUseEngineStore.mockReturnValue({
      routes: [{ season: "summer" }],
      tick: 10,
      homeAirport: { iata: "JFK" },
      tickProgress: 0.5,
      catchupProgress: null,
    });
    mockUseAirlineStore.mockReturnValue({
      competitors: new Map(),
      fleetByOwner: new Map(),
      routesByOwner: new Map(),
      fleet: [],
      routes: [],
    });

    render(<Ticker />);
    expect(screen.getAllByText("Verano").length).toBeGreaterThan(0);
  });

  it("turns the live dot amber when relays are down", () => {
    relayHealth.status = "offline";
    mockUseEngineStore.mockReturnValue({
      routes: [],
      tick: 10,
      homeAirport: { iata: "JFK" },
      tickProgress: 0,
      catchupProgress: null,
    });
    mockUseAirlineStore.mockReturnValue({
      competitors: new Map(),
      fleetByOwner: new Map(),
      routesByOwner: new Map(),
      fleet: [],
      routes: [],
    });

    render(<Ticker />);
    const live = screen.getByTestId("ticker-live");
    expect(live).toHaveAttribute("data-status", "offline");
    expect(live).toHaveClass("text-amber-400");
    expect(live).toHaveTextContent("Offline");
  });

  it("shows the UTC clock, next landing and today's cash for a player", () => {
    // 2026-10-05 14:07:30 UTC.
    const tick = Math.floor((Date.parse("2026-10-05T14:07:30Z") - GENESIS_TIME) / TICK_DURATION);
    mockUseEngineStore.mockReturnValue({
      routes: [],
      tick,
      homeAirport: { iata: "MAD" },
      tickProgress: 0,
      catchupProgress: null,
    });
    mockUseAirlineStore.mockReturnValue({
      airline: { name: "Test Air" },
      competitors: new Map(),
      fleetByOwner: new Map(),
      routesByOwner: new Map(),
      fleet: [
        {
          id: "a1",
          name: "Alpha",
          status: "enroute",
          flight: { destinationIata: "BCN", arrivalTick: tick + TICKS_PER_HOUR + 300 },
        },
      ],
      timeline: [
        { tick: tick - 10, type: "landing", revenue: fp(5000), cost: fp(2000) },
        { tick: tick - 5, type: "lease_payment", cost: fp(500) },
        // Yesterday: not counted.
        { tick: tick - 20 * TICKS_PER_HOUR, type: "landing", revenue: fp(9000), cost: fp(0) },
      ],
      routes: [],
    });

    render(<Ticker />);
    expect(screen.getByTestId("ticker-clock")).toHaveTextContent("14:07");
    expect(screen.getByTestId("ticker-next-landing")).toHaveTextContent("BCN in 1h 15m");
    expect(screen.getByTestId("ticker-cash-today")).toHaveTextContent("+$2,500");
  });
});
