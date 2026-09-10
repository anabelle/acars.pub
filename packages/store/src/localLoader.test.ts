import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const dbMock = {
    airline: {
      where: vi.fn(() => ({ first: vi.fn().mockResolvedValue(null) })),
      put: vi.fn().mockResolvedValue(undefined),
    },
    fleet: {
      where: vi.fn(() => ({
        toArray: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(0),
      })),
      bulkPut: vi.fn().mockResolvedValue(undefined),
    },
    routes: {
      where: vi.fn(() => ({
        toArray: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(0),
      })),
      bulkPut: vi.fn().mockResolvedValue(undefined),
    },
    transaction: vi.fn(async () => undefined),
    meta: {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    },
    outbox: {
      toArray: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
  const loadSnapshotMock = vi.fn().mockResolvedValue(null);
  const computeHashMock = vi.fn().mockResolvedValue("hash-mock");
  const decompressMock = vi.fn().mockResolvedValue("");
  const reconcileMock = vi.fn(() => ({
    fleet: [],
    events: [],
    balanceDelta: 0,
  }));
  const engineState = { tick: 1000 };
  return { dbMock, loadSnapshotMock, computeHashMock, decompressMock, reconcileMock, engineState };
});

vi.mock("./db.js", () => ({ db: mocks.dbMock }));
vi.mock("@acars/nostr", () => ({
  loadSnapshot: mocks.loadSnapshotMock,
  decompressSnapshotString: mocks.decompressMock,
  parseCheckpoint: (data: unknown) => data,
}));
vi.mock("@acars/core", async (importOriginal) => {
  // Real `fp` (and future helpers) for the validation module; the two
  // behavioral overrides below are load-bearing for these fixtures.
  const actual = await importOriginal<typeof import("@acars/core")>();
  return {
    fp: actual.fp,
    createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }),
    computeCheckpointStateHash: mocks.computeHashMock,
    decompressSnapshotString: mocks.decompressMock,
    fpAdd: (a: number, b: number) => a + b,
  };
});
vi.mock("./engine.js", () => ({
  useEngineStore: {
    getState: () => ({ tick: mocks.engineState.tick }),
    subscribe: vi.fn(),
    setState: vi.fn(),
    getInitialState: () => ({ tick: mocks.engineState.tick }),
  },
}));
vi.mock("./FlightEngine.js", () => ({
  reconcileFleetToTick: mocks.reconcileMock,
}));

import { hydrateIdentityFromStorage } from "./localLoader.js";

function resetChains() {
  mocks.dbMock.airline.where.mockReturnValue({ first: vi.fn().mockResolvedValue(null) });
  mocks.dbMock.fleet.where.mockReturnValue({
    toArray: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(0),
  });
  mocks.dbMock.routes.where.mockReturnValue({
    toArray: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(0),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetChains();
  mocks.loadSnapshotMock.mockResolvedValue(null);
  mocks.decompressMock.mockResolvedValue("");
  mocks.computeHashMock.mockResolvedValue("hash-mock");
  mocks.dbMock.meta.get.mockResolvedValue(undefined);
  mocks.dbMock.outbox.toArray.mockResolvedValue([]);
  mocks.reconcileMock.mockReturnValue({ fleet: [], events: [], balanceDelta: 0 });
  mocks.engineState.tick = 1000;
});

describe("hydrateIdentityFromStorage", () => {
  it("sets a ready guest state when no local or remote data exists", async () => {
    const set = vi.fn();
    await hydrateIdentityFromStorage("me", set);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        pubkey: "me",
        airline: null,
        identityStatus: "ready",
        isLoading: false,
      }),
    );
  });

  it("reconciles and commits local state when local data exists but no remote snapshot", async () => {
    const airline = {
      id: "a1",
      ceoPubkey: "me",
      lastTick: 1000,
      corporateBalance: 1000,
      timeline: [],
    };
    mocks.dbMock.airline.where.mockReturnValue({ first: vi.fn().mockResolvedValue(airline) });
    mocks.dbMock.fleet.where.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
    mocks.dbMock.routes.where.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

    const set = vi.fn();
    await hydrateIdentityFromStorage("me", set);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ pubkey: "me", identityStatus: "ready" }),
    );
    const arg = set.mock.calls[0][0];
    expect(arg.airline.id).toBe("a1");
    // engineTick equals lastTick → no reconciliation needed
    expect(mocks.reconcileMock).not.toHaveBeenCalled();
  });

  it("reconciles fleet forward when engine tick is ahead of lastTick", async () => {
    const airline = {
      id: "a1",
      ceoPubkey: "me",
      lastTick: 100,
      corporateBalance: 1000,
      timeline: [],
    };
    const fleet = [{ id: "ac-1", ownerPubkey: "me" }];
    mocks.dbMock.airline.where.mockReturnValue({ first: vi.fn().mockResolvedValue(airline) });
    mocks.dbMock.fleet.where.mockReturnValue({ toArray: vi.fn().mockResolvedValue(fleet) });
    mocks.dbMock.routes.where.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
    mocks.reconcileMock.mockReturnValue({
      fleet: [{ id: "ac-1", ownerPubkey: "me", cycles: 1 }],
      events: [{ id: "evt-1" }],
      balanceDelta: 500,
    });

    const set = vi.fn();
    await hydrateIdentityFromStorage("me", set);
    expect(mocks.reconcileMock).toHaveBeenCalledWith(fleet, [], 1000);
    const arg = set.mock.calls[0][0];
    expect(arg.airline.corporateBalance).toBe(1500);
    expect(arg.airline.lastTick).toBe(1000);
    expect(arg.timeline).toEqual([{ id: "evt-1" }]);
  });

  it("clamps a stale lastTick to the max catchup window", async () => {
    const airline = {
      id: "a1",
      ceoPubkey: "me",
      lastTick: 0,
      corporateBalance: 0,
      timeline: [],
    };
    const fleet = [{ id: "ac-1", ownerPubkey: "me" }];
    mocks.dbMock.airline.where.mockReturnValue({ first: vi.fn().mockResolvedValue(airline) });
    mocks.dbMock.fleet.where.mockReturnValue({ toArray: vi.fn().mockResolvedValue(fleet) });
    mocks.dbMock.routes.where.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

    const set = vi.fn();
    await hydrateIdentityFromStorage("me", set);
    // lastTick 0 with fleet → clamped to engineTick - 50000 = -49000 → 0
    // then reconciled to 1000.
    expect(mocks.reconcileMock).toHaveBeenCalled();
  });

  it("overwrites local state when a newer remote snapshot arrives", async () => {
    const remoteCheckpoint = {
      schemaVersion: 1,
      tick: 5000,
      createdAt: 1,
      actionChainHash: "chain-remote",
      stateHash: "hash-remote",
      actionSeq: 15,
      airline: {
        id: "remote-air",
        ceoPubkey: "me",
        lastTick: 5000,
        corporateBalance: 0,
        timeline: [],
      },
      fleet: [],
      routes: [],
      timeline: [],
    };
    mocks.loadSnapshotMock.mockResolvedValue({
      compressedData: "gz:remote",
      stateHash: "hash-remote",
      tick: 5000,
    });
    mocks.decompressMock.mockResolvedValue(JSON.stringify(remoteCheckpoint));
    // Verification: recomputed state hash must equal the declared hashes.
    mocks.computeHashMock.mockResolvedValue("hash-remote");

    const set = vi.fn();
    await hydrateIdentityFromStorage("me", set);
    const arg = set.mock.calls[0][0];
    expect(arg.airline.id).toBe("remote-air");
    expect(arg.actionChainHash).toBe("chain-remote");
    // Persisted actionSeq restored from the snapshot payload.
    expect(arg.actionSeq).toBe(15);
    // The verified snapshot becomes the latest known checkpoint.
    expect(arg.latestCheckpoint).toEqual(expect.objectContaining({ tick: 5000 }));
  });

  it("keeps local state when a newer remote snapshot fails verification", async () => {
    const localAirline = {
      id: "local-air",
      ceoPubkey: "me",
      lastTick: 1000,
      corporateBalance: 0,
      timeline: [],
    };
    mocks.dbMock.airline.where.mockReturnValue({ first: vi.fn().mockResolvedValue(localAirline) });
    const remoteCheckpoint = {
      schemaVersion: 1,
      tick: 9000,
      createdAt: 1,
      actionChainHash: "chain-evil",
      stateHash: "hash-declared",
      airline: {
        id: "remote-evil",
        ceoPubkey: "me",
        lastTick: 9000,
        corporateBalance: 0,
        timeline: [],
      },
      fleet: [],
      routes: [],
      timeline: [],
    };
    mocks.loadSnapshotMock.mockResolvedValue({
      compressedData: "gz:evil",
      stateHash: "hash-declared",
      tick: 9000,
    });
    mocks.decompressMock.mockResolvedValue(JSON.stringify(remoteCheckpoint));
    // Recomputed hash does NOT match the declared one → reject.
    mocks.computeHashMock.mockResolvedValue("hash-recomputed-different");

    const set = vi.fn();
    await hydrateIdentityFromStorage("me", set);
    const arg = set.mock.calls[0][0];
    expect(arg.airline.id).toBe("local-air");
  });

  it("restores actionSeq from the local meta table when no remote snapshot applies", async () => {
    const airline = {
      id: "a1",
      ceoPubkey: "me",
      lastTick: 1000,
      corporateBalance: 0,
      timeline: [],
    };
    mocks.dbMock.airline.where.mockReturnValue({ first: vi.fn().mockResolvedValue(airline) });
    mocks.dbMock.meta.get.mockResolvedValue({ key: "actionSeq:me", value: 12 });

    const set = vi.fn();
    await hydrateIdentityFromStorage("me", set);
    const arg = set.mock.calls[0][0];
    expect(arg.actionSeq).toBe(12);
  });

  it("keeps local state when remote snapshot is older", async () => {
    const localAirline = {
      id: "local-air",
      ceoPubkey: "me",
      lastTick: 9000,
      corporateBalance: 0,
      timeline: [],
    };
    mocks.dbMock.airline.where.mockReturnValue({ first: vi.fn().mockResolvedValue(localAirline) });
    const remoteCheckpoint = {
      schemaVersion: 1,
      tick: 100,
      createdAt: 1,
      actionChainHash: "chain-old",
      stateHash: "hash-old",
      airline: {
        id: "remote-old",
        ceoPubkey: "me",
        lastTick: 100,
        corporateBalance: 0,
        timeline: [],
      },
      fleet: [],
      routes: [],
      timeline: [],
    };
    mocks.loadSnapshotMock.mockResolvedValue({
      compressedData: "gz:old",
      stateHash: "hash-old",
      tick: 100,
    });
    mocks.decompressMock.mockResolvedValue(JSON.stringify(remoteCheckpoint));

    const set = vi.fn();
    await hydrateIdentityFromStorage("me", set);
    const arg = set.mock.calls[0][0];
    expect(arg.airline.id).toBe("local-air");
  });

  it("swallows remote snapshot failures and keeps local state", async () => {
    const localAirline = {
      id: "local-air",
      ceoPubkey: "me",
      lastTick: 1000,
      corporateBalance: 0,
      timeline: [],
    };
    mocks.dbMock.airline.where.mockReturnValue({ first: vi.fn().mockResolvedValue(localAirline) });
    mocks.loadSnapshotMock.mockRejectedValue(new Error("relay down"));

    const set = vi.fn();
    await expect(hydrateIdentityFromStorage("me", set)).resolves.toBeUndefined();
    const arg = set.mock.calls[0][0];
    expect(arg.airline.id).toBe("local-air");
  });
});
