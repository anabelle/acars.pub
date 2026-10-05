import type { AirlineEntity } from "@acars/core";
import { fp, fpToNumber } from "@acars/core";
import { aircraftModels, setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { cleanup, render, screen } from "@testing-library/react";
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

afterEach(cleanup);

describe("recommendAircraftForRoute", () => {
  it("recommends a profitable aircraft unlocked at the airline's tier", () => {
    const recommendation = recommendAircraftForRoute({ ...base, tier: 1 });
    expect(recommendation).not.toBeNull();
    expect(recommendation?.model.unlockTier).toBeLessThanOrEqual(1);
    expect(recommendation?.model.rangeKm).toBeGreaterThanOrEqual(483);
    expect(recommendation?.profitAfterLeasePerDay).toBeGreaterThan(0);
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
    Object.assign(airlineState, {
      airline: { tier: 1, brandScore: 0.5 } as Partial<AirlineEntity>,
      routes: [],
      pubkey: "me",
      globalRouteRegistry: new Map(),
    });
    render(<RouteDecisionCard originIata="MAD" destinationIata="BCN" distanceKm={483} />);

    expect(screen.getByTestId("route-decision-card")).toBeInTheDocument();
    expect(screen.getByTestId("route-decision-profit").textContent).toMatch(/\$[\d,]+\/day/);
    expect(screen.getByText(/Best aircraft:/)).toBeInTheDocument();
  });

  it("explains when no unlocked aircraft can fly the distance", () => {
    Object.assign(airlineState, {
      airline: { tier: 1, brandScore: 0.5 } as Partial<AirlineEntity>,
      routes: [],
      pubkey: "me",
      globalRouteRegistry: new Map(),
    });
    render(<RouteDecisionCard originIata="MAD" destinationIata="JFK" distanceKm={5770} />);
    expect(screen.getByText(/can fly 5,770 km yet/)).toBeInTheDocument();
  });
});
