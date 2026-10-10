import type { AirlineEntity } from "@acars/core";
import { fp, fpToNumber } from "@acars/core";
import { aircraftModels, setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

type Selector<T> = (state: T) => unknown;
const airlineState: Record<string, unknown> = {};
const engineState = { tick: 100_000 };

vi.mock("@acars/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@acars/store")>();
  return {
    ...actual,
    useAirlineStore: (selector: Selector<typeof airlineState>) => selector(airlineState),
    useEngineStore: (selector: Selector<typeof engineState>) => selector(engineState),
  };
});

const confirmMock = vi.fn<(options: { title: string; description: string }) => Promise<boolean>>(
  async () => true,
);
vi.mock("@/shared/lib/useConfirm", () => ({ useConfirm: () => confirmMock }));

const launchMock = vi.fn();
let launchState: { phase: string; result?: unknown } = { phase: "idle" };
vi.mock("@/features/network/hooks/useLaunchRoute", () => ({
  useLaunchRoute: () => ({ state: launchState, launch: launchMock, reset: vi.fn() }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { recommendAircraftForRoute } from "@/features/network/utils/routeRecommendation";
import { RouteDecisionCard } from "./RouteDecisionCard";

const base = {
  originIata: "MAD",
  destinationIata: "BCN",
  distanceKm: 483,
  tick: 100_000,
  brandScore: 0.5,
  playerPubkey: "me",
  competitorOffers: [],
  networkRoutes: [{ originIata: "MAD", destinationIata: "BCN", frequencyPerWeek: 7 }],
};

beforeAll(() => {
  setAirportsCatalog(airports);
});

afterEach(() => {
  cleanup();
  confirmMock.mockClear();
  launchMock.mockReset();
  launchState = { phase: "idle" };
});

function setAirline(overrides: Record<string, unknown> = {}) {
  Object.assign(airlineState, {
    airline: { tier: 1, brandScore: 0.5 } as Partial<AirlineEntity>,
    routes: [],
    fleet: [],
    pubkey: "me",
    globalRouteRegistry: new Map(),
    ...overrides,
  });
}

describe("recommendAircraftForRoute", () => {
  it("recommends a profitable aircraft unlocked at the airline's tier", () => {
    const recommendation = recommendAircraftForRoute({ ...base, tier: 1 });
    expect(recommendation).not.toBeNull();
    expect(recommendation?.model.unlockTier).toBeLessThanOrEqual(1);
    expect(recommendation?.model.rangeKm).toBeGreaterThanOrEqual(483);
    expect(recommendation?.profitAfterLeasePerDay).toBeGreaterThan(0);
  });

  it("projects a new route at its best frequency, not the opening 7 a week (S58)", () => {
    const best = recommendAircraftForRoute({ ...base, tier: 1 });
    const fixed = recommendAircraftForRoute({ ...base, tier: 1, frequencyPerWeek: 7 });
    expect(best?.frequencyPerWeek).toBeGreaterThan(7);
    expect(fixed?.frequencyPerWeek).toBe(7);
    expect(best?.projection.profitPerDay ?? 0).toBeGreaterThan(fixed?.projection.profitPerDay ?? 0);
  });

  it("returns null when no unlocked aircraft has the range", () => {
    expect(recommendAircraftForRoute({ ...base, distanceKm: 8000, tier: 1 })).toBeNull();
  });

  it("picks the cheapest profitable lease among the candidates", () => {
    const recommendation = recommendAircraftForRoute({ ...base, tier: 1 });
    const tierOne = aircraftModels.filter((m) => m.unlockTier <= 1 && m.rangeKm >= 483);
    const cheaperProfitable = tierOne.filter(
      (m) => recommendation && m.monthlyLease < recommendation.model.monthlyLease,
    );
    for (const model of cheaperProfitable) {
      const alt = recommendAircraftForRoute({ ...base, tier: 1, catalog: [model] });
      expect(fpToNumber(alt?.profitAfterLeasePerDay ?? fp(0))).toBeLessThanOrEqual(0);
    }
  });
});

describe("RouteDecisionCard", () => {
  it("shows the projected daily profit and the recommended aircraft", () => {
    setAirline();
    render(<RouteDecisionCard originIata="MAD" destinationIata="BCN" distanceKm={483} />);

    expect(screen.getByTestId("route-decision-card")).toBeInTheDocument();
    expect(screen.getByTestId("route-decision-profit").textContent).toMatch(/\$[\d,]+\/day/);
    expect(screen.getByText(/Best aircraft:/)).toBeInTheDocument();
  });

  it("explains when no unlocked aircraft can fly the distance", () => {
    setAirline();
    render(<RouteDecisionCard originIata="MAD" destinationIata="JFK" distanceKm={5770} />);
    expect(screen.getByText(/can fly 5,770 km yet/)).toBeInTheDocument();
  });

  it("confirms the costs, then launches the recommended route", async () => {
    setAirline();
    launchMock.mockResolvedValue({ status: "complete", completed: [] });
    render(<RouteDecisionCard originIata="MAD" destinationIata="BCN" distanceKm={483} />);

    fireEvent.click(screen.getByRole("button", { name: /Launch route with/ }));

    await waitFor(() => expect(launchMock).toHaveBeenCalledTimes(1));
    expect(confirmMock.mock.calls[0][0].description).toMatch(/Slot fee \$100,000/);
    expect(confirmMock.mock.calls[0][0].description).toMatch(/lease deposit/);
    expect(launchMock.mock.calls[0][0]).toMatchObject({
      originIata: "MAD",
      destinationIata: "BCN",
      distanceKm: 483,
      model: expect.objectContaining({ id: expect.any(String) }),
    });
  });

  it("does nothing when the player cancels the confirmation", async () => {
    setAirline();
    confirmMock.mockResolvedValueOnce(false);
    render(<RouteDecisionCard originIata="MAD" destinationIata="BCN" distanceKm={483} />);

    fireEvent.click(screen.getByRole("button", { name: /Launch route with/ }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("offers to finish the setup of a route that has no aircraft", () => {
    setAirline({
      routes: [{ id: "r1", originIata: "MAD", destinationIata: "BCN", frequencyPerWeek: 7 }],
    });
    launchState = {
      phase: "done",
      result: {
        status: "partial",
        completed: ["openRoute"],
        failedStep: "acquireAircraft",
        error: "Insufficient funds",
      },
    };
    render(<RouteDecisionCard originIata="MAD" destinationIata="BCN" distanceKm={483} />);

    expect(screen.getByRole("button", { name: /Finish setup/ })).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toMatch(
      /leasing the aircraft failed.*Insufficient funds/,
    );
  });

  it("hides the launch button once the route has an aircraft", () => {
    setAirline({
      routes: [{ id: "r1", originIata: "MAD", destinationIata: "BCN", frequencyPerWeek: 7 }],
      fleet: [{ id: "a1", assignedRouteId: "r1" }],
    });
    render(<RouteDecisionCard originIata="MAD" destinationIata="BCN" distanceKm={483} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names the market's incumbent and our share of the market (S10)", () => {
    setAirline();
    render(<RouteDecisionCard originIata="MAD" destinationIata="BCN" distanceKm={483} />);
    expect(screen.getByTestId("route-decision-market").textContent).toMatch(
      /An established airline flies this [\d,]+ times a week and holds >?\d+% of the market/,
    );
    expect(screen.getByTestId("route-decision-share").textContent).toMatch(/^(<1|\d+)%$/);
  });

  it("calls a thin market uncontested", () => {
    setAirline();
    render(<RouteDecisionCard originIata="LIH" destinationIata="KOA" distanceKm={423} />);
    expect(screen.getByTestId("route-decision-market").textContent).toMatch(
      /No airline serves this market yet/,
    );
    expect(screen.getByTestId("route-decision-share").textContent).toBe("100%");
  });
});
