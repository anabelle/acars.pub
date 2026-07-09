import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the airline store as a plain selector function over a mutable state
// object so useActiveAirline() can be exercised without a React renderer.
const stateRef: { current: Record<string, unknown> } = { current: {} };

vi.mock("./airline.js", () => ({
  useAirlineStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(stateRef.current),
}));

import { useActiveAirline } from "./hooks.js";

beforeEach(() => {
  stateRef.current = {
    viewedPubkey: null,
    pubkey: "me",
    airline: { id: "my-airline" },
    fleet: [{ id: "ac-1" }],
    routes: [{ id: "r-1" }],
    timeline: [{ id: "t-1" }],
    competitors: new Map(),
    fleetByOwner: new Map(),
    routesByOwner: new Map(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useActiveAirline", () => {
  it("returns the canonical player state when not viewing anyone", () => {
    const view = useActiveAirline();
    expect(view.isViewingOther).toBe(false);
    expect(view.isGuest).toBe(false);
    expect(view.airline).toEqual({ id: "my-airline" });
    expect(view.fleet).toHaveLength(1);
  });

  it("treats a guest (no airline) as isGuest even when not viewing others", () => {
    stateRef.current.airline = null;
    const view = useActiveAirline();
    expect(view.isGuest).toBe(true);
    expect(view.airline).toBeNull();
  });

  it("returns canonical state when viewing your own pubkey (viewAs self)", () => {
    stateRef.current.viewedPubkey = "me";
    const view = useActiveAirline();
    expect(view.isViewingOther).toBe(false);
    expect(view.airline).toEqual({ id: "my-airline" });
  });

  it("projects competitor state when viewing another airline", () => {
    stateRef.current.viewedPubkey = "competitor-1";
    stateRef.current.competitors = new Map([["competitor-1", { id: "comp-air" }]]);
    stateRef.current.fleetByOwner = new Map([["competitor-1", [{ id: "comp-ac" }]]]);
    stateRef.current.routesByOwner = new Map([["competitor-1", [{ id: "comp-r" }]]]);
    const view = useActiveAirline();
    expect(view.isViewingOther).toBe(true);
    expect(view.airline).toEqual({ id: "comp-air" });
    expect(view.fleet).toEqual([{ id: "comp-ac" }]);
    expect(view.routes).toEqual([{ id: "comp-r" }]);
    expect(view.timeline).toEqual([]);
    // isGuest reflects whether the PLAYER has an airline, not the viewed one.
    expect(view.isGuest).toBe(false);
  });

  it("falls back to null airline and empty arrays for an unknown competitor", () => {
    stateRef.current.viewedPubkey = "ghost";
    const view = useActiveAirline();
    expect(view.isViewingOther).toBe(true);
    expect(view.airline).toBeNull();
    expect(view.fleet).toEqual([]);
    expect(view.routes).toEqual([]);
  });

  it("isGuest is true when viewing another airline while the player has none", () => {
    stateRef.current.airline = null;
    stateRef.current.viewedPubkey = "competitor-1";
    stateRef.current.competitors = new Map([["competitor-1", { id: "comp-air" }]]);
    const view = useActiveAirline();
    expect(view.isViewingOther).toBe(true);
    expect(view.isGuest).toBe(true);
  });
});
