import { fp } from "@acars/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const storeState = {
  airline: { tier: 1, brandScore: 0.5 },
  pubkey: "me",
  routes: [],
  fleet: [],
  globalRouteRegistry: new Map([
    ["MAD-NEAR", [{ airlinePubkey: "rival-1" }, { airlinePubkey: "me" }]],
  ]) as Map<string, { airlinePubkey: string }[]>,
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
const confirm = vi.fn<(options: { title: string; description?: string }) => Promise<boolean>>(
  async () => false,
);
vi.mock("@/shared/lib/useConfirm", () => ({ useConfirm: () => confirm }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

// Projected profit per day by destination; FAR has no aircraft with the range.
const PROFIT: Record<string, number | null> = { NEAR: 1200, MID: 4800, LOSS: -300, FAR: null };
const recommend = vi.fn((input: { destinationIata: string }) => {
  const profit = PROFIT[input.destinationIata];
  return profit === null
    ? null
    : {
        model: {
          name: "ATR 72-600",
          manufacturer: "ATR",
          price: fp(26_000_000),
          monthlyLease: fp(156_000),
          deliveryTimeTicks: 60,
          speedKmh: 500,
        },
        profitAfterLeasePerDay: fp(profit),
      };
});
vi.mock("@/features/network/utils/routeRecommendation", () => ({
  NEW_ROUTE_WEEKLY_FREQUENCY: 7,
  DAYS_PER_LEASE_MONTH: 30,
  recommendAircraftForRoute: (input: never) => recommend(input),
}));

import { formatFlightTime } from "../utils/flightTime";
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
    expect(profits[0]).toContain("with the ATR 72-600, after lease");
    expect(profits[3]).toContain("Out of range");
  });

  it("projects each market as a new route added to the network", () => {
    render(<OpportunitiesList {...props} markets={[market("NEAR")]} />);
    expect(recommend).toHaveBeenCalledWith(
      expect.objectContaining({
        originIata: "MAD",
        destinationIata: "NEAR",
        distanceKm: 500,
        networkRoutes: [{ originIata: "MAD", destinationIata: "NEAR", frequencyPerWeek: 7 }],
      }),
    );
  });

  it("launches a route with its plane, asking once with the full cost", async () => {
    render(<OpportunitiesList {...props} markets={[market("NEAR"), market("FAR")]} />);
    const [near, far] = screen.getAllByTestId("opportunity-launch");
    expect(near).toHaveTextContent("Launch route");
    expect(far).toBeDisabled();
    fireEvent.click(near);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    const options = confirm.mock.calls[0][0];
    expect(options.title).toContain("MAD → NEAR");
    expect(options.description).toContain("lease deposit");
  });

  it("leads with flight time, profit and rivals; market numbers wait behind details (S78)", () => {
    render(<OpportunitiesList {...props} markets={[market("NEAR"), market("MID")]} />);
    const [mid, near] = screen.getAllByTestId("opportunity-flight-time");
    expect(mid).toHaveTextContent("1 h");
    expect(near).toHaveTextContent("500 km");
    const rivals = screen.getAllByTestId("opportunity-rivals").map((node) => node.textContent);
    // MID has nobody; NEAR has one rival (the player's own offer doesn't count).
    expect(rivals).toEqual(["Rival airlinesNone", "Rival airlines1"]);
    const details = screen.getAllByTestId("opportunity-details")[0] as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details).toHaveTextContent(/Total market/i);
  });

  it("formats flight time in hours and minutes", () => {
    expect(formatFlightTime(0.75)).toBe("45 min");
    expect(formatFlightTime(2)).toBe("2 h");
    expect(formatFlightTime(1.84)).toBe("1 h 50 min");
  });
});
