import { fp, getSuggestedFares, fpToNumber } from "@acars/core";
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
  assignedAircraftIds: [],
};

vi.mock("@acars/store", () => ({
  useActiveAirline: () => ({ routes: [route], fleet: [] }),
  useEngineStore: (selector: (state: { tick: number }) => unknown) => selector({ tick: 1000 }),
  useAirlineStore: (selector: (state: { updateRouteFares: typeof updateRouteFares }) => unknown) =>
    selector({ updateRouteFares }),
}));
// No aircraft is assigned, so the demand snapshot never changes the outcome.
vi.mock("@/features/network/hooks/useRouteDemand", () => ({
  getRouteDemandSnapshotCached: () => null,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/shared/lib/permalinkNavigation", () => ({ navigateToAirport: vi.fn() }));

import { FareEditor } from "./FareEditor";

const target = { routeId: "r1", originIata: "MAD", destinationIata: "BCN", distanceKm: 483 };

afterEach(() => {
  cleanup();
  updateRouteFares.mockClear();
});

describe("FareEditor", () => {
  it("starts from the route's current fares", () => {
    render(<FareEditor target={target} onClose={() => {}} />);
    expect(screen.getByLabelText("Economy")).toHaveValue(120);
    expect(screen.getByLabelText("Business")).toHaveValue(300);
    expect(screen.getByLabelText("First")).toHaveValue(600);
    expect(screen.getByText(/Assign aircraft to see revenue projection/)).toBeInTheDocument();
  });

  it("fills in the suggested fares", () => {
    render(<FareEditor target={target} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /use suggested fares/i }));
    const suggested = getSuggestedFares(483);
    expect(screen.getByLabelText("Economy")).toHaveValue(fpToNumber(suggested.economy));
    expect(screen.getByLabelText("First")).toHaveValue(fpToNumber(suggested.first));
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
});
