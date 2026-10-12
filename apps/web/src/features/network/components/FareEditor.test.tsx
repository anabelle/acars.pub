import { fp, fpToNumber, getSuggestedFares } from "@acars/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateRouteFares = vi.fn<(routeId: string, fares: unknown) => Promise<void>>(async () => {});
const route = {
  id: "r1",
  originIata: "MAD",
  destinationIata: "BCN",
  distanceKm: 483,
  fareEconomy: fp(120),
  fareBusiness: fp(300),
  fareFirst: fp(600),
  assignedAircraftIds: [] as string[],
  frequencyPerWeek: 7,
  // Opened today (tick 1000): fares change at once (S69).
  openedAtTick: 1000 as number | undefined,
  pending: undefined as Record<string, unknown> | undefined,
};
const fleet: unknown[] = [];

// A stand-in for the engine forecast: cheaper economy fills more seats.
const projectRouteEconomics = vi.fn((input: { fares: { economy: number } }) => {
  const economy = fpToNumber(input.fares.economy as never);
  const loadFactor = Math.min(1, 0.8 + (120 - economy) / 200);
  return {
    loadFactor,
    marketShare: loadFactor / 2,
    profitPerDay: fp(Math.round(economy * loadFactor * 10)),
  };
});

vi.mock("@acars/store", () => ({
  projectRouteEconomics: (input: never) => projectRouteEconomics(input),
  fareCurve: () => ({
    points: [
      { x: 0.8, profitPerDay: 900, loadFactor: 0.9, share: 0.45 },
      { x: 1, profitPerDay: 960, loadFactor: 0.8, share: 0.4 },
      { x: 1.2, profitPerDay: 1100, loadFactor: 0.7, share: 0.35 },
    ],
    best: 1.2,
    current: 1,
  }),
  useActiveAirline: () => ({ routes: [route], fleet }),
  useEngineStore: (selector: (state: { tick: number }) => unknown) => selector({ tick: 1000 }),
  useAirlineStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      updateRouteFares,
      airline: { tier: 1, brandScore: 0.5 },
      pubkey: "me",
      globalRouteRegistry: new Map(),
    }),
}));
vi.mock("@acars/data", () => ({
  getAircraftById: (id: string) => (id === "atr72-600" ? { id, name: "ATR 72" } : undefined),
  getAirports: () => [{ iata: "BCN", tags: ["business"] }],
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: (m: string) => toastSuccess(m) } }));
vi.mock("@/shared/lib/permalinkNavigation", () => ({ navigateToAirport: vi.fn() }));

import { FareEditor } from "./FareEditor";

const target = { routeId: "r1", originIata: "MAD", destinationIata: "BCN", distanceKm: 483 };

const flyRoute = () => {
  route.assignedAircraftIds = ["a1"];
  fleet.splice(0, fleet.length, {
    id: "a1",
    modelId: "atr72-600",
    configuration: { economy: 70, business: 0, first: 0, cargoKg: 0 },
  });
};

afterEach(() => {
  cleanup();
  updateRouteFares.mockClear();
  projectRouteEconomics.mockClear();
  route.assignedAircraftIds = [];
  route.openedAtTick = 1000;
  route.pending = undefined;
  toastSuccess.mockClear();
  fleet.splice(0, fleet.length);
});

describe("FareEditor", () => {
  it("starts from the route's current fares", () => {
    render(<FareEditor target={target} onClose={() => {}} />);
    expect(screen.getByLabelText("Economy")).toHaveValue(120);
    expect(screen.getByLabelText("Business")).toHaveValue(300);
    expect(screen.getByLabelText("First")).toHaveValue(600);
    expect(screen.getByText(/Assign an aircraft to this route/)).toBeInTheDocument();
    expect(projectRouteEconomics).not.toHaveBeenCalled();
  });

  it("applies presets and marks the active one", () => {
    render(<FareEditor target={target} onClose={() => {}} />);
    const suggested = screen.getByRole("button", { name: "Suggested" });
    expect(suggested).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(suggested);
    const fares = getSuggestedFares(483);
    expect(screen.getByLabelText("Economy")).toHaveValue(fpToNumber(fares.economy));
    expect(screen.getByLabelText("First")).toHaveValue(fpToNumber(fares.first));
    expect(suggested).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Aggressive" }));
    expect(screen.getByLabelText("Economy")).toHaveValue(
      Math.round(fpToNumber(fares.economy) * 0.85),
    );
    expect(screen.getByRole("button", { name: "Aggressive" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(suggested).toHaveAttribute("aria-pressed", "false");
  });

  it("projects the typed fares against today's as you type", () => {
    flyRoute();
    render(<FareEditor target={target} onClose={() => {}} />);
    const outcome = screen.getByTestId("fare-outcome");
    expect(screen.getByTestId("fare-outcome-load")).toHaveTextContent("80%");
    expect(outcome).toHaveTextContent(/Same as now/);

    fireEvent.change(screen.getByLabelText("Economy"), { target: { value: "100" } });
    expect(screen.getByTestId("fare-outcome-load")).toHaveTextContent("90%");
    expect(screen.getByTestId("fare-outcome-load")).toHaveTextContent("+10 pts vs now");
    expect(screen.getByTestId("fare-outcome-share")).toHaveTextContent("45%");
    // The engine forecast gets the route's real aircraft, seats and frequency.
    expect(projectRouteEconomics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        originIata: "MAD",
        destinationIata: "BCN",
        aircraftCount: 1,
        frequencyPerWeek: 7,
        seatConfig: { economy: 70, business: 0, first: 0 },
        fares: { economy: fp(100), business: fp(300), first: fp(600) },
      }),
    );
  });

  it("saves the typed fares and closes", async () => {
    const onClose = vi.fn();
    render(<FareEditor target={target} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Economy"), { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: /save fares/i }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateRouteFares).toHaveBeenCalledWith("r1", {
      economy: fp(99),
      business: fp(300),
      first: fp(600),
    });
  });

  it("asks for at least one fare", () => {
    render(<FareEditor target={target} onClose={() => {}} />);
    for (const label of ["Economy", "Business", "First"]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: "" } });
    }
    fireEvent.click(screen.getByRole("button", { name: /save fares/i }));
    expect(updateRouteFares).not.toHaveBeenCalled();
    expect(screen.getByText(/at least one/i)).toBeInTheDocument();
  });

  it("shows the fare what-if and scales the saved fares to its best point (S64)", () => {
    flyRoute();
    render(<FareEditor target={target} onClose={() => {}} />);
    expect(screen.getByTestId("fare-curve")).toBeInTheDocument();
    expect(screen.getByTestId("what-if-readout")).toHaveTextContent("fares 120%");
    fireEvent.click(screen.getByTestId("what-if-best"));
    expect(screen.getByLabelText("Economy")).toHaveValue(144);
    expect(screen.getByLabelText("Business")).toHaveValue(360);
    expect(screen.getByLabelText("First")).toHaveValue(720);
  });

  it("says changes apply now on a route opened today", () => {
    render(<FareEditor target={target} onClose={() => {}} />);
    expect(screen.getByTestId("timetable-hint")).toHaveTextContent(/apply now/i);
    expect(screen.queryByTestId("timetable-announced")).toBeNull();
  });

  it("announces fares for tomorrow on a published route, starting from the announced ones (S69)", async () => {
    route.openedAtTick = undefined;
    route.pending = { effectiveTick: 99_999, fareEconomy: fp(110) };
    const onClose = vi.fn();
    render(<FareEditor target={target} onClose={onClose} />);
    expect(screen.getByTestId("timetable-hint")).toHaveTextContent(/00:00 UTC tomorrow/);
    expect(screen.getByTestId("timetable-announced")).toHaveTextContent("E $110");
    expect(screen.getByLabelText("Economy")).toHaveValue(110);
    fireEvent.click(screen.getByRole("button", { name: /announce for tomorrow/i }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith("Announced for 00:00 UTC tomorrow");
  });
});
