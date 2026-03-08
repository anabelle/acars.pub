import { describe, expect, it, vi } from "vitest";
import { hydrateIdentityFromStorage } from "./localLoader";

const { airlineTable, fleetTable, mutedPubkeysTable, routesTable } = vi.hoisted(() => ({
  airlineTable: {
    where: vi.fn(() => ({
      first: vi.fn(() => Promise.resolve(null)),
      delete: vi.fn(() => Promise.resolve()),
    })),
    put: vi.fn(() => Promise.resolve()),
  },
  fleetTable: {
    where: vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([])),
      delete: vi.fn(() => Promise.resolve()),
    })),
    bulkPut: vi.fn(() => Promise.resolve()),
  },
  routesTable: {
    where: vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([])),
      delete: vi.fn(() => Promise.resolve()),
    })),
    bulkPut: vi.fn(() => Promise.resolve()),
  },
  mutedPubkeysTable: {
    get: vi.fn(() =>
      Promise.resolve({ ownerPubkey: "player", pubkeys: ["local-comp"], updatedAt: 1 }),
    ),
    put: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@acars/nostr", () => ({
  loadSnapshot: vi.fn(() => Promise.resolve(null)),
  loadMuteList: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("./db.js", () => ({
  db: {
    airline: airlineTable,
    fleet: fleetTable,
    routes: routesTable,
    mutedPubkeys: mutedPubkeysTable,
    transaction: vi.fn((_mode, ...args) => args.at(-1)()),
  },
}));

vi.mock("./engine.js", () => ({
  useEngineStore: {
    getState: () => ({ tick: 100 }),
  },
}));

vi.mock("./FlightEngine.js", () => ({
  reconcileFleetToTick: vi.fn(() => ({
    fleet: [],
    events: [],
    balanceDelta: 0,
  })),
}));

describe("hydrateIdentityFromStorage", () => {
  it("hydrates muted pubkeys from local cache when remote mute list is unavailable", async () => {
    const set = vi.fn();

    await hydrateIdentityFromStorage("player", set);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        pubkey: "player",
        mutedPubkeys: new Set(["local-comp"]),
      }),
    );
  });

  it("prefers the remote mute list and refreshes the local cache", async () => {
    const { loadMuteList } = await import("@acars/nostr");
    vi.mocked(loadMuteList).mockResolvedValueOnce(new Set(["remote-comp"]));
    const set = vi.fn();

    await hydrateIdentityFromStorage("player", set);

    expect(mutedPubkeysTable.put).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerPubkey: "player",
        pubkeys: ["remote-comp"],
      }),
    );
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        mutedPubkeys: new Set(["remote-comp"]),
      }),
    );
  });
});
