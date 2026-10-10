import type { Route } from "@acars/core";
import { fp } from "@acars/core";
import { setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const updateRouteFrequency = vi.fn(async () => {});
const applySuggestedFrequency = vi.fn(async () => 46);
const storeState: Record<string, unknown> = {
  fleet: [],
  routes: [],
  airline: { ceoPubkey: "me", brandScore: 0.5, tier: 1 },
  globalRouteRegistry: new Map(),
  updateRouteFrequency,
  applySuggestedFrequency,
};
vi.mock("@acars/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@acars/store")>()),
  useAirlineStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
  useEngineStore: (selector: (state: { tick: number }) => unknown) => selector({ tick: 1000 }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { RouteFrequencyControl } from "./RouteFrequencyControl";

const route: Route = {
  id: "r1",
  originIata: "MAD",
  destinationIata: "BCN",
  airlinePubkey: "me",
  distanceKm: 483,
  frequencyPerWeek: 7,
  assignedAircraftIds: ["a1"],
  fareEconomy: fp(150),
  fareBusiness: fp(450),
  fareFirst: fp(800),
  status: "active",
};
const atr = { id: "a1", modelId: "atr72-600", assignedRouteId: "r1" };

beforeAll(() => {
  setAirportsCatalog(airports);
});

afterEach(() => {
  cleanup();
  updateRouteFrequency.mockClear();
  applySuggestedFrequency.mockClear();
  storeState.fleet = [];
  storeState.routes = [];
});

describe("RouteFrequencyControl", () => {
  it("steps the frequency locally and publishes once on Apply", async () => {
    storeState.fleet = [atr];
    render(<RouteFrequencyControl route={route} />);
    expect(screen.getByText("7/wk")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 legs\/day · max \d+\/wk with this fleet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /more round trips/i }));
    fireEvent.click(screen.getByRole("button", { name: /more round trips/i }));
    expect(screen.getByText("9/wk")).toBeInTheDocument();
    expect(updateRouteFrequency).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await vi.waitFor(() => expect(updateRouteFrequency).toHaveBeenCalledWith("r1", 9));
  });

  it("stops at what the assigned fleet can physically fly", () => {
    storeState.fleet = [atr];
    render(<RouteFrequencyControl route={route} />);
    const max = Number(
      /max (\d+)\/wk/.exec(screen.getByText(/max \d+\/wk/).textContent ?? "")?.[1],
    );
    expect(max).toBeGreaterThan(7);
    const more = screen.getByRole("button", { name: /more round trips/i });
    for (let i = 0; i < max + 5; i += 1) fireEvent.click(more);
    expect(screen.getByText(`${max}/wk`)).toBeInTheDocument();
    expect(more).toBeDisabled();
  });

  it("never goes below one and explains when no aircraft flies it", () => {
    render(<RouteFrequencyControl route={{ ...route, frequencyPerWeek: 1 }} />);
    expect(screen.getByRole("button", { name: /fewer round trips/i })).toBeDisabled();
    expect(screen.getByText(/Assign an aircraft to fly it/)).toBeInTheDocument();
  });

  it("flags idle planes and applies the suggested frequency in one tap (S58)", async () => {
    storeState.fleet = [atr];
    storeState.routes = [route];
    render(<RouteFrequencyControl route={route} />);
    expect(screen.getByTestId("route-block-hours")).toHaveTextContent(
      /block h\/day per plane · idle most of the day/,
    );
    const flyMore = screen.getByTestId("route-fly-more");
    expect(flyMore.textContent).toMatch(/Fly more · \d+\/wk/);
    fireEvent.click(flyMore);
    await vi.waitFor(() => expect(applySuggestedFrequency).toHaveBeenCalledWith("r1"));
  });

  it("does not nag when the route already flies its suggestion", () => {
    storeState.fleet = [atr];
    const busy = { ...route, frequencyPerWeek: 140 };
    storeState.routes = [busy];
    render(<RouteFrequencyControl route={busy} />);
    expect(screen.getByTestId("route-block-hours")).not.toHaveTextContent(/idle/);
    expect(screen.queryByTestId("route-fly-more")).toBeNull();
  });
});
