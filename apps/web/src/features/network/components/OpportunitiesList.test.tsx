import { fp } from "@acars/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const storeState = {
  airline: { tier: 1, brandScore: 0.5 },
  pubkey: "me",
  routes: [],
  globalRouteRegistry: new Map(),
  openRoute: vi.fn(),
};
vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
  useEngineStore: (selector: (state: { tick: number }) => unknown) => selector({ tick: 5000 }),
}));
vi.mock("@acars/data", () => ({ HUB_CLASSIFICATIONS: {} }));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 220,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 220 })),
    measureElement: () => {},
    options: { scrollMargin: 0 },
  }),
}));
vi.mock("@/shared/components/layout/panelScrollContext", () => ({
  usePanelScrollRef: () => ({ current: null }),
}));
vi.mock("@/shared/lib/useConfirm", () => ({ useConfirm: () => async () => false }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

// Projected profit per day by destination; FAR has no aircraft with the range.
const PROFIT: Record<string, number | null> = { NEAR: 1200, MID: 4800, LOSS: -300, FAR: null };
const recommend = vi.fn((input: { destinationIata: string }) => {
  const profit = PROFIT[input.destinationIata];
  return profit === null
    ? null
    : { model: { name: "ATR 72-600" }, profitAfterLeasePerDay: fp(profit) };
});
vi.mock("@/features/network/utils/routeRecommendation", () => ({
  NEW_ROUTE_WEEKLY_FREQUENCY: 7,
  recommendAircraftForRoute: (input: never) => recommend(input),
}));

import { OpportunitiesList, type ProspectMarket } from "./OpportunitiesList";

const airport = (iata: string) =>
  ({ iata, icao: "", city: `${iata} city`, country: "ES", latitude: 0, longitude: 0 }) as never;
const market = (iata: string): ProspectMarket => ({
  origin: airport("MAD"),
  destination: airport(iata),
  distance: 500,
  demand: { economy: 1000, business: 100, first: 10 },
  estimatedDailyRevenue: fp(0),
  season: "summer",
  routeEconomics: null,
});

const props = {
  activeRoutes: [],
  isViewingOther: false,
  canOpenFromOrigin: true,
  originSlotControlled: false,
  searchQuery: "",
  searchResultCount: 0,
};

afterEach(() => {
  cleanup();
  recommend.mockClear();
});

describe("OpportunitiesList", () => {
  it("lists the most profitable market per day first", () => {
    render(
      <OpportunitiesList
        {...props}
        markets={[market("NEAR"), market("FAR"), market("LOSS"), market("MID")]}
      />,
    );
    const order = screen
      .getAllByText(/^(NEAR|MID|LOSS|FAR)$/)
      .map((node) => node.textContent?.trim());
    expect(order).toEqual(["MID", "NEAR", "LOSS", "FAR"]);

    const profits = screen.getAllByTestId("opportunity-profit").map((node) => node.textContent);
    expect(profits[0]).toContain("$4,800");
    expect(profits[0]).toContain("with an ATR 72-600, after lease");
    expect(profits[3]).toContain("Out of range");
  });

  it("projects each market as a new route added to the network", () => {
    render(<OpportunitiesList {...props} markets={[market("NEAR")]} />);
    expect(recommend).toHaveBeenCalledWith(
      expect.objectContaining({
        originIata: "MAD",
        destinationIata: "NEAR",
        distanceKm: 500,
        frequencyPerWeek: 7,
        networkRoutes: [{ originIata: "MAD", destinationIata: "NEAR", frequencyPerWeek: 7 }],
      }),
    );
  });
});
