import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateRouteFrequency = vi.fn(async () => {});
const storeState: Record<string, unknown> = { fleet: [], updateRouteFrequency };
vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { RouteFrequencyControl } from "./RouteFrequencyControl";

const route = { id: "r1", distanceKm: 483, frequencyPerWeek: 7 };
const atr = { id: "a1", modelId: "atr72-600", assignedRouteId: "r1" };

afterEach(() => {
  cleanup();
  updateRouteFrequency.mockClear();
  storeState.fleet = [];
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
});
