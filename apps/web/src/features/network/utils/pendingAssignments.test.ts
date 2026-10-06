import type { AircraftInstance, Route } from "@acars/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadPendingAssignments,
  type PendingAssignment,
  resolvePendingAssignments,
  savePendingAssignments,
  withPending,
} from "./pendingAssignments";

const ac = (id: string, extra: Partial<AircraftInstance> = {}) =>
  ({
    id,
    status: "idle",
    baseAirportIata: "MAD",
    assignedRouteId: null,
    ...extra,
  }) as AircraftInstance;
const route = (id: string, status: Route["status"] = "active") => ({ id, status }) as Route;
const entry = (aircraftId: string, routeId = "r1", ferryTo = "MAD"): PendingAssignment => ({
  aircraftId,
  routeId,
  ferryTo,
});

describe("resolvePendingAssignments()", () => {
  it("sorts entries into ready, waiting and dropped", () => {
    const fleet = [
      ac("landed"),
      ac("flying", { status: "enroute", baseAirportIata: "LIS" }),
      ac("turnaround", { status: "turnaround" }),
      ac("elsewhere", { baseAirportIata: "LIS" }),
      ac("done", { assignedRouteId: "r1" }),
    ];
    const result = resolvePendingAssignments(
      [
        entry("landed"),
        entry("flying"),
        entry("turnaround"),
        entry("elsewhere"),
        entry("done"),
        entry("gone"),
        entry("landed-closed", "r-closed"),
      ],
      [...fleet, ac("landed-closed")],
      [route("r1"), route("r-closed", "suspended")],
    );
    expect(result.ready.map((e) => e.aircraftId)).toEqual(["landed", "turnaround"]);
    expect(result.waiting.map((e) => e.aircraftId)).toEqual(["flying"]);
    expect(result.dropped.map((e) => e.aircraftId)).toEqual([
      "elsewhere",
      "done",
      "gone",
      "landed-closed",
    ]);
  });
});

describe("withPending()", () => {
  it("keeps one entry per aircraft", () => {
    const list = withPending([entry("a", "r1"), entry("b")], entry("a", "r2"));
    expect(list).toEqual([entry("b"), entry("a", "r2")]);
  });
});

describe("storage", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("round-trips per airline and clears when empty", () => {
    savePendingAssignments("pk", [entry("a")]);
    expect(loadPendingAssignments("pk")).toEqual([entry("a")]);
    expect(loadPendingAssignments("other")).toEqual([]);
    savePendingAssignments("pk", []);
    expect(window.localStorage.getItem("acars_pending_assignments:pk")).toBeNull();
  });

  it("ignores corrupt data", () => {
    window.localStorage.setItem("acars_pending_assignments:pk", "{");
    expect(loadPendingAssignments("pk")).toEqual([]);
    window.localStorage.setItem("acars_pending_assignments:pk", JSON.stringify({ a: 1 }));
    expect(loadPendingAssignments("pk")).toEqual([]);
    window.localStorage.setItem(
      "acars_pending_assignments:pk",
      JSON.stringify([entry("a"), { aircraftId: 1 }, null]),
    );
    expect(loadPendingAssignments("pk")).toEqual([entry("a")]);
  });

  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => savePendingAssignments("pk", [entry("a")])).not.toThrow();
  });
});
