import type { AircraftInstance, Route } from "@acars/core";
import { fp } from "@acars/core";
import { getAircraftById } from "@acars/data";
import { describe, expect, it, vi } from "vitest";
import { type LaunchDeps, type LaunchPlan, launchRoute } from "./launchRoute";

const model = getAircraftById("atr72-600")!;
const plan: LaunchPlan = { originIata: "MAD", destinationIata: "BCN", distanceKm: 483, model };

function makeRoute(id = "route-1"): Route {
  return {
    id,
    originIata: "MAD",
    destinationIata: "BCN",
    airlinePubkey: "me",
    distanceKm: 483,
    frequencyPerWeek: 7,
    assignedAircraftIds: [],
    fareEconomy: fp(100),
    fareBusiness: fp(300),
    fareFirst: fp(700),
    status: "active",
  };
}

function makeAircraft(id: string, overrides: Partial<AircraftInstance> = {}): AircraftInstance {
  return {
    id,
    ownerPubkey: "me",
    modelId: "atr72-600",
    name: id,
    status: "idle",
    assignedRouteId: null,
    baseAirportIata: "MAD",
    purchasedAtTick: 0,
    purchasePrice: fp(1),
    birthTick: 0,
    listingPrice: null,
    flight: null,
    purchaseType: "lease",
    flightHoursTotal: 0,
    flightHoursSinceCheck: 0,
    condition: 1,
    ...overrides,
  } as AircraftInstance;
}

/** A tiny in-memory store whose actions mutate state like the real slices do. */
function fakeStore(initial: { routes?: Route[]; fleet?: AircraftInstance[] } = {}) {
  const state = { routes: initial.routes ?? [], fleet: initial.fleet ?? [] };
  const deps: LaunchDeps = {
    openRoute: vi.fn(async () => {
      state.routes = [...state.routes, makeRoute(`route-${state.routes.length + 1}`)];
    }),
    leaseAircraft: vi.fn(async () => {
      state.fleet = [
        ...state.fleet,
        makeAircraft(`leased-${state.fleet.length + 1}`, { status: "delivery" }),
      ];
    }),
    assignAircraftToRoute: vi.fn(async (aircraftId: string, routeId: string) => {
      state.fleet = state.fleet.map((a) =>
        a.id === aircraftId ? { ...a, assignedRouteId: routeId } : a,
      );
    }),
    getState: () => state,
  };
  return { state, deps };
}

describe("launchRoute", () => {
  it("opens the route, leases an aircraft and assigns it", async () => {
    const { deps, state } = fakeStore();
    const result = await launchRoute(deps, plan);

    expect(result).toMatchObject({
      status: "complete",
      completed: ["openRoute", "acquireAircraft", "assignAircraft"],
      routeId: "route-1",
      aircraftId: "leased-1",
      reusedAircraft: false,
    });
    expect(deps.leaseAircraft).toHaveBeenCalledWith(model, "MAD");
    expect(state.fleet[0].assignedRouteId).toBe("route-1");
  });

  it("reuses an existing route and an idle aircraft at the origin", async () => {
    const { deps } = fakeStore({ routes: [makeRoute()], fleet: [makeAircraft("spare")] });
    const result = await launchRoute(deps, plan);

    expect(result).toMatchObject({ status: "complete", aircraftId: "spare", reusedAircraft: true });
    expect(deps.openRoute).not.toHaveBeenCalled();
    expect(deps.leaseAircraft).not.toHaveBeenCalled();
  });

  it("does not reuse aircraft parked elsewhere, already assigned, or without the range", async () => {
    const { deps } = fakeStore({
      fleet: [
        makeAircraft("elsewhere", { baseAirportIata: "LIS" }),
        makeAircraft("busy", { assignedRouteId: "other" }),
        makeAircraft("short", { modelId: "atr42-600" }),
      ],
    });
    const result = await launchRoute(deps, { ...plan, distanceKm: 1500 });
    expect(result.reusedAircraft).toBe(false);
    expect(deps.leaseAircraft).toHaveBeenCalledTimes(1);
  });

  it("reports a partial launch when leasing fails, then resumes on retry", async () => {
    const { deps } = fakeStore();
    vi.mocked(deps.leaseAircraft).mockRejectedValueOnce(
      new Error("Insufficient corporate balance"),
    );

    const first = await launchRoute(deps, plan);
    expect(first).toMatchObject({
      status: "partial",
      completed: ["openRoute"],
      failedStep: "acquireAircraft",
      error: "Insufficient corporate balance",
      routeId: "route-1",
    });

    const retry = await launchRoute(deps, plan);
    expect(retry.status).toBe("complete");
    expect(deps.openRoute).toHaveBeenCalledTimes(1);
    expect(deps.leaseAircraft).toHaveBeenCalledTimes(2);
  });

  it("reuses the leased aircraft when only the assignment failed", async () => {
    const { deps } = fakeStore();
    vi.mocked(deps.assignAircraftToRoute).mockRejectedValueOnce(new Error("relay timeout"));

    const first = await launchRoute(deps, plan);
    expect(first).toMatchObject({
      status: "partial",
      failedStep: "assignAircraft",
      aircraftId: "leased-1",
    });

    const retry = await launchRoute(deps, plan);
    expect(retry).toMatchObject({
      status: "complete",
      aircraftId: "leased-1",
      reusedAircraft: true,
    });
    expect(deps.leaseAircraft).toHaveBeenCalledTimes(1);
  });

  it("fails cleanly when the route cannot be opened", async () => {
    const { deps } = fakeStore();
    vi.mocked(deps.openRoute).mockRejectedValueOnce(new Error("Slot capacity exceeded"));
    const result = await launchRoute(deps, plan);
    expect(result).toMatchObject({ status: "failed", completed: [], failedStep: "openRoute" });
    expect(deps.leaseAircraft).not.toHaveBeenCalled();
  });

  it("is a no-op when the route already has an aircraft", async () => {
    const { deps } = fakeStore({
      routes: [makeRoute()],
      fleet: [makeAircraft("flying", { status: "enroute", assignedRouteId: "route-1" })],
    });
    const result = await launchRoute(deps, plan);
    expect(result).toMatchObject({ status: "complete", aircraftId: "flying" });
    expect(deps.leaseAircraft).not.toHaveBeenCalled();
    expect(deps.assignAircraftToRoute).not.toHaveBeenCalled();
  });
});
