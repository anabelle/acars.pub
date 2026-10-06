import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const assignAircraftToRoute = vi.fn<(aircraftId: string, routeId: string) => Promise<void>>(
  async () => {},
);
const fleet: unknown[] = [];

vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ fleet, airline: { hubs: ["MAD"] }, assignAircraftToRoute }),
}));
vi.mock("@acars/data", () => ({
  getAircraftById: (id: string) =>
    id === "atr72-600" ? { id, name: "ATR 72-600", rangeKm: 1528 } : undefined,
  getAirports: () => [
    { iata: "MAD", latitude: 40.47, longitude: -3.56 },
    { iata: "BCN", latitude: 41.3, longitude: 2.08 },
    { iata: "LIS", latitude: 38.77, longitude: -9.13 },
  ],
}));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 64,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 64 })),
  }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const ferryAndAssign = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/features/network/hooks/useFerryAndAssign", () => ({
  useFerryAndAssign: () => ferryAndAssign,
}));
vi.mock("sonner", () => ({ toast }));

import { AssignAircraftDialog } from "./AssignAircraftDialog";

const route = {
  id: "r1",
  originIata: "MAD",
  destinationIata: "BCN",
  distanceKm: 483,
  status: "active",
  assignedAircraftIds: [],
} as never;

const aircraft = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  modelId: "atr72-600",
  status: "idle",
  assignedRouteId: null,
  baseAirportIata: "MAD",
  ...extra,
});

afterEach(() => {
  cleanup();
  assignAircraftToRoute.mockClear();
  toast.success.mockClear();
  toast.error.mockClear();
  ferryAndAssign.mockClear();
  fleet.splice(0, fleet.length);
});

describe("AssignAircraftDialog", () => {
  it("lists ready aircraft first and explains the others", () => {
    fleet.push(
      aircraft("a-ferry", "Lisbon One", { baseAirportIata: "LIS" }),
      aircraft("a-air", "Flying", { status: "enroute" }),
      aircraft("a-ready", "Madrid One"),
    );
    render(<AssignAircraftDialog route={route} onClose={() => {}} />);
    const rows = screen.getAllByTestId("assign-candidate");
    expect(rows.map((row) => row.getAttribute("data-kind"))).toEqual(["ready", "ferry", "blocked"]);
    expect(rows[0]).toHaveTextContent("Madrid One");
    expect(rows[1]).toHaveTextContent("needs a");
    expect(rows[2]).toHaveTextContent("In flight");
    expect(screen.getAllByRole("button", { name: "Assign" })).toHaveLength(1);
  });

  it("assigns and closes", async () => {
    fleet.push(aircraft("a-ready", "Madrid One"));
    const onClose = vi.fn();
    render(<AssignAircraftDialog route={route} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(assignAircraftToRoute).toHaveBeenCalledWith("a-ready", "r1");
    expect(toast.success).toHaveBeenCalled();
  });

  it("keeps the dialog open and reports a failed assignment", async () => {
    fleet.push(aircraft("a-ready", "Madrid One"));
    assignAircraftToRoute.mockRejectedValueOnce(new Error("nope"));
    const onClose = vi.fn();
    render(<AssignAircraftDialog route={route} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't assign the aircraft", {
        description: "nope",
      }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says so when the fleet is empty, and closes from the backdrop", () => {
    const onClose = vi.fn();
    render(<AssignAircraftDialog route={route} onClose={onClose} />);
    expect(screen.getByText(/You have no aircraft yet/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("ferries and assigns an aircraft from elsewhere", async () => {
    fleet.push(aircraft("a-lis", "Lisbon One", { baseAirportIata: "LIS" }));
    const onClose = vi.fn();
    render(<AssignAircraftDialog route={route} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Ferry + assign" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(ferryAndAssign).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a-lis" }),
      route,
      "MAD",
      expect.any(Number),
    );
  });

  it("stays open when the ferry is cancelled", async () => {
    fleet.push(aircraft("a-lis", "Lisbon One", { baseAirportIata: "LIS" }));
    ferryAndAssign.mockResolvedValueOnce(false);
    const onClose = vi.fn();
    render(<AssignAircraftDialog route={route} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Ferry + assign" }));
    await waitFor(() => expect(ferryAndAssign).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
