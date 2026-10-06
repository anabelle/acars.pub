import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const assignAircraftToRoute = vi.fn<(aircraftId: string, routeId: string) => Promise<void>>(
  async () => {},
);
const routes: unknown[] = [];

vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ routes, airline: { hubs: ["MAD", "LIS"] }, assignAircraftToRoute }),
}));
vi.mock("@acars/data", () => ({
  getAircraftById: (id: string) =>
    id === "atr72-600" ? { id, name: "ATR 72-600", rangeKm: 1528 } : undefined,
  getAirports: () => [
    { iata: "MAD", latitude: 40.47, longitude: -3.56 },
    { iata: "BCN", latitude: 41.3, longitude: 2.08 },
    { iata: "LIS", latitude: 38.77, longitude: -9.13 },
    { iata: "JFK", latitude: 40.64, longitude: -73.78 },
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
vi.mock("sonner", () => ({ toast }));
const ferryAndAssign = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/features/network/hooks/useFerryAndAssign", () => ({
  useFerryAndAssign: () => ferryAndAssign,
}));

import { AssignRouteDialog } from "./AssignRouteDialog";

const aircraft = {
  id: "a1",
  name: "Madrid One",
  modelId: "atr72-600",
  status: "idle",
  assignedRouteId: null,
  baseAirportIata: "MAD",
} as never;

const route = (id: string, originIata: string, destinationIata: string, distanceKm: number) => ({
  id,
  originIata,
  destinationIata,
  distanceKm,
  status: "active",
  assignedAircraftIds: [],
});

afterEach(() => {
  cleanup();
  assignAircraftToRoute.mockReset();
  toast.success.mockClear();
  toast.error.mockClear();
  ferryAndAssign.mockClear();
  routes.splice(0, routes.length);
});

describe("AssignRouteDialog", () => {
  it("lists ready routes, then ferries, then blocked", () => {
    routes.push(
      route("r-lis-opo", "LIS", "OPO", 280),
      route("r-mad-jfk", "MAD", "JFK", 5770),
      route("r-mad-bcn", "MAD", "BCN", 483),
    );
    render(<AssignRouteDialog aircraft={aircraft} onClose={() => {}} />);
    const rows = screen.getAllByTestId("assign-route-candidate");
    expect(rows.map((row) => row.getAttribute("data-kind"))).toEqual(["ready", "ferry", "blocked"]);
    expect(rows[0]).toHaveTextContent("MAD → BCN");
    expect(rows[2]).toHaveTextContent("Not enough range");
  });

  it("assigns a ready route", async () => {
    routes.push(route("r-mad-bcn", "MAD", "BCN", 483));
    const onClose = vi.fn();
    render(<AssignRouteDialog aircraft={aircraft} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(assignAircraftToRoute).toHaveBeenCalledWith("a1", "r-mad-bcn");
  });

  it("reports a failed assignment", async () => {
    routes.push(route("r-mad-bcn", "MAD", "BCN", 483));
    assignAircraftToRoute.mockRejectedValueOnce(new Error("nope"));
    render(<AssignRouteDialog aircraft={aircraft} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("ferries to a route elsewhere and closes when sent", async () => {
    routes.push(route("r-lis-opo", "LIS", "OPO", 280));
    const onClose = vi.fn();
    render(<AssignRouteDialog aircraft={aircraft} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Ferry + assign" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(ferryAndAssign).toHaveBeenCalledWith(aircraft, routes[0], "LIS", expect.any(Number));
  });

  it("says so with no routes, and closes", () => {
    const onClose = vi.fn();
    render(<AssignRouteDialog aircraft={aircraft} onClose={onClose} />);
    expect(screen.getByText(/no active routes yet/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[1]);
    expect(onClose).toHaveBeenCalled();
  });
});
