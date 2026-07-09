import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const publishActionMock = vi.fn();
  const publishSnapshotMock = vi.fn();
  const replayMock = vi.fn();
  const compressMock = vi.fn();
  const computeHashMock = vi.fn();
  const dbMock = {
    airline: { put: vi.fn().mockResolvedValue(undefined) },
    fleet: {
      where: vi.fn(() => ({ delete: vi.fn().mockResolvedValue(0) })),
      bulkPut: vi.fn().mockResolvedValue(undefined),
    },
    routes: {
      where: vi.fn(() => ({ delete: vi.fn().mockResolvedValue(0) })),
      bulkPut: vi.fn().mockResolvedValue(undefined),
    },
    transaction: vi.fn(async () => undefined),
  };
  const engineState = { tick: 42 };
  return {
    publishActionMock,
    publishSnapshotMock,
    replayMock,
    compressMock,
    computeHashMock,
    dbMock,
    engineState,
  };
});

vi.mock("@acars/nostr", () => ({
  publishAction: mocks.publishActionMock,
  publishSnapshot: mocks.publishSnapshotMock,
}));
vi.mock("./actionReducer.js", () => ({ replayActionLog: mocks.replayMock }));
vi.mock("./db.js", () => ({ db: mocks.dbMock }));
vi.mock("./utils/asyncQueue.js", () => ({
  // Execute the update immediately so we can observe the side effects.
  enqueueSerialUpdate: async (fn: () => Promise<void>) => fn(),
}));
vi.mock("./engine.js", () => ({
  useEngineStore: {
    getState: () => ({ tick: mocks.engineState.tick }),
    subscribe: vi.fn(),
    setState: vi.fn(),
    getInitialState: () => ({ tick: mocks.engineState.tick }),
  },
}));
vi.mock("@acars/core", () => ({
  computeCheckpointStateHash: mocks.computeHashMock,
  compressSnapshotString: mocks.compressMock,
}));

import { publishActionWithChain, publishCurrentStateSnapshot } from "./actionChain.js";
import type { AirlineState } from "./types.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.publishActionMock.mockResolvedValue({
    id: "evt-1",
    author: { pubkey: "me" },
    created_at: 123,
  });
  mocks.publishSnapshotMock.mockResolvedValue(undefined);
  mocks.replayMock.mockResolvedValue({
    airline: { id: "a1", ceoPubkey: "me" },
    fleet: [],
    routes: [],
    timeline: [],
    actionChainHash: "new-chain",
  });
  mocks.compressMock.mockResolvedValue("gz:data");
  mocks.computeHashMock.mockResolvedValue("hash-1");
  mocks.engineState.tick = 42;
});

describe("publishActionWithChain", () => {
  it("throws when no airline exists yet", async () => {
    const get = () =>
      ({
        airline: null,
        actionSeq: 0,
        actionChainHash: "",
        latestCheckpoint: null,
      }) as Partial<AirlineState> as AirlineState;
    await expect(
      publishActionWithChain({
        action: { action: "AIRLINE_CREATE", payload: {} } as never,
        get: get as never,
        set: vi.fn(),
      }),
    ).rejects.toThrow("no airline");
  });

  it("publishes, replays, commits state, and persists", async () => {
    const store: Partial<AirlineState> = {
      airline: { id: "a1", ceoPubkey: "me" } as never,
      fleet: [],
      routes: [],
      timeline: [],
      pubkey: "me",
      actionSeq: 5,
      actionChainHash: "prev-chain",
      latestCheckpoint: null,
    };
    const get = () => store as AirlineState;
    const set = vi.fn((partial: Partial<AirlineState>) => Object.assign(store, partial));

    const event = await publishActionWithChain({
      action: { action: "TICK_UPDATE", payload: { tick: 1 } } as never,
      get: get as never,
      set,
    });

    expect(event.id).toBe("evt-1");
    // actionSeq incremented immediately
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ actionSeq: 6 }));
    expect(mocks.publishActionMock).toHaveBeenCalledTimes(1);
    expect(mocks.replayMock).toHaveBeenCalledTimes(1);
    // Persistence transaction ran
    expect(mocks.dbMock.transaction).toHaveBeenCalled();
  });

  it("does not persist when replay produces no airline", async () => {
    mocks.replayMock.mockResolvedValue({
      airline: null,
      fleet: [],
      routes: [],
      timeline: [],
      actionChainHash: "x",
    });
    const store: Partial<AirlineState> = {
      airline: { id: "a1", ceoPubkey: "me" } as never,
      fleet: [],
      routes: [],
      timeline: [],
      actionSeq: 0,
      actionChainHash: "",
      latestCheckpoint: null,
    };
    await publishActionWithChain({
      action: { action: "TICK_UPDATE", payload: {} } as never,
      get: (() => store) as never,
      set: vi.fn((p) => Object.assign(store, p)),
    });
    expect(mocks.dbMock.transaction).not.toHaveBeenCalled();
  });
});

describe("publishCurrentStateSnapshot", () => {
  it("is a no-op when there is no airline", async () => {
    await publishCurrentStateSnapshot({ airline: null } as never);
    expect(mocks.computeHashMock).not.toHaveBeenCalled();
  });

  it("compresses and publishes a snapshot when an airline exists", async () => {
    await publishCurrentStateSnapshot({
      airline: { id: "a1" } as never,
      fleet: [],
      routes: [],
      timeline: [],
      actionChainHash: "chain",
    } as never);
    expect(mocks.computeHashMock).toHaveBeenCalledTimes(1);
    expect(mocks.compressMock).toHaveBeenCalledTimes(1);
    expect(mocks.publishSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ compressedData: "gz:data", stateHash: "hash-1" }),
    );
  });
});
