import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const assignAircraftToRoute = vi.fn<(aircraftId: string, routeId: string) => Promise<void>>(
  async () => {},
);
const state: { pubkey: string | null; fleet: unknown[]; routes: unknown[] } = {
  pubkey: "pk",
  fleet: [],
  routes: [],
};
vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ ...state, assignAircraftToRoute }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import {
  loadPendingAssignments,
  savePendingAssignments,
} from "@/features/network/utils/pendingAssignments";
import { PendingAssignmentsRunner } from "./PendingAssignmentsRunner";

const route = { id: "r1", originIata: "MAD", destinationIata: "BCN", status: "active" };
const plane = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  status: "idle",
  baseAirportIata: "MAD",
  assignedRouteId: null,
  ...extra,
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  assignAircraftToRoute.mockReset();
  toast.success.mockClear();
  toast.error.mockClear();
  state.pubkey = "pk";
  state.fleet = [];
  state.routes = [];
});

describe("PendingAssignmentsRunner", () => {
  it("assigns landed aircraft and keeps the ones still flying", async () => {
    state.routes = [route];
    state.fleet = [plane("landed"), plane("flying", { status: "enroute" })];
    savePendingAssignments("pk", [
      { aircraftId: "landed", routeId: "r1", ferryTo: "MAD" },
      { aircraftId: "flying", routeId: "r1", ferryTo: "MAD" },
    ]);
    render(<PendingAssignmentsRunner />);
    await waitFor(() => expect(assignAircraftToRoute).toHaveBeenCalledWith("landed", "r1"));
    expect(assignAircraftToRoute).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(loadPendingAssignments("pk")).toEqual([
      { aircraftId: "flying", routeId: "r1", ferryTo: "MAD" },
    ]);
  });

  it("reports a failed assignment and drops stale entries", async () => {
    state.routes = [route];
    state.fleet = [plane("landed")];
    assignAircraftToRoute.mockRejectedValueOnce(new Error("nope"));
    savePendingAssignments("pk", [
      { aircraftId: "landed", routeId: "r1", ferryTo: "MAD" },
      { aircraftId: "gone", routeId: "r1", ferryTo: "MAD" },
    ]);
    render(<PendingAssignmentsRunner />);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't assign the aircraft", {
        description: "nope",
      }),
    );
    expect(loadPendingAssignments("pk")).toEqual([]);
  });

  it("prunes dropped entries without assigning, and re-reads on the queue event", async () => {
    state.routes = [route];
    state.fleet = [plane("elsewhere", { baseAirportIata: "LIS" })];
    savePendingAssignments("pk", [{ aircraftId: "elsewhere", routeId: "r1", ferryTo: "MAD" }]);
    render(<PendingAssignmentsRunner />);
    await waitFor(() => expect(loadPendingAssignments("pk")).toEqual([]));
    expect(assignAircraftToRoute).not.toHaveBeenCalled();

    state.fleet = [plane("landed")];
    savePendingAssignments("pk", [{ aircraftId: "landed", routeId: "r1", ferryTo: "MAD" }]);
    act(() => {
      window.dispatchEvent(new Event("acars:pending-assignments"));
    });
    await waitFor(() => expect(assignAircraftToRoute).toHaveBeenCalledWith("landed", "r1"));
  });

  it("does nothing without a signed-in airline or a queue", () => {
    state.pubkey = null;
    render(<PendingAssignmentsRunner />);
    state.pubkey = "pk";
    render(<PendingAssignmentsRunner />);
    expect(assignAircraftToRoute).not.toHaveBeenCalled();
  });
});
