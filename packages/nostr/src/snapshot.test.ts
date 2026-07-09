import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeEvent {
  id: string;
  kind?: number;
  created_at?: number;
  content: string;
  tags?: string[][];
  author?: { pubkey: string };
}

const mock = vi.hoisted(() => {
  class MockNDKEvent {
    kind: number | undefined;
    tags: string[][] = [];
    content = "";
    id = `evt-${Math.random().toString(36).slice(2, 8)}`;
    async publish() {
      return mock.state.publishImpl(this);
    }
  }

  const state = {
    pageQueue: [] as FakeEvent[][],
    publishImpl: async () => {},
  };

  const ndkMock = {
    signer: {} as unknown,
    subscribe: () => {
      const handlers: Record<string, Array<(...a: unknown[]) => void>> = {};
      const sub = {
        on(name: string, cb: (...a: unknown[]) => void) {
          (handlers[name] ||= []).push(cb);
          return sub;
        },
        stop: () => {},
      };
      const page = state.pageQueue.length > 0 ? state.pageQueue.shift()! : [];
      queueMicrotask(() => {
        for (const ev of page) for (const cb of handlers.event || []) cb(ev);
        for (const cb of handlers.eose || []) cb();
      });
      return sub;
    },
  };

  return { MockNDKEvent, state, ndkMock };
});

vi.mock("./ndk.js", () => ({
  ensureConnected: vi.fn().mockResolvedValue(undefined),
  getNDK: () => mock.ndkMock,
}));

vi.mock("@nostr-dev-kit/ndk", () => ({ NDKEvent: mock.MockNDKEvent }));

// schema.js validators are used by snapshot.ts — delegate to the real module
// (they are pure functions over the event shape).
import { SNAPSHOT_D_TAG, loadAllSnapshots, loadSnapshot, publishSnapshot } from "./snapshot.js";
import type { SnapshotPayload } from "./snapshot.js";

const NOW = Math.floor(Date.now() / 1000);

function snapEvent(overrides: Partial<FakeEvent> & { content?: string }): FakeEvent {
  const payload: SnapshotPayload = {
    compressedData: "gz:abc",
    stateHash: "hash-1",
    tick: 10,
  };
  return {
    id: overrides.id ?? `snap-${Math.random().toString(36).slice(2, 8)}`,
    kind: 30078,
    created_at: overrides.created_at ?? NOW,
    author: overrides.author ?? { pubkey: "me" },
    tags: [
      ["d", SNAPSHOT_D_TAG],
      ["world", "v6-beta"],
    ],
    content: overrides.content ?? JSON.stringify(payload),
  };
}

beforeEach(() => {
  mock.state.pageQueue = [];
  mock.state.publishImpl = async () => {};
  mock.ndkMock.signer = {};
});

describe("snapshot publish", () => {
  it("throws without a signer", async () => {
    mock.ndkMock.signer = undefined;
    await expect(publishSnapshot({ compressedData: "x", stateHash: "h", tick: 1 })).rejects.toThrow(
      "No signer",
    );
  });

  it("publishes a snapshot event on success", async () => {
    let published = false;
    mock.state.publishImpl = async () => {
      published = true;
    };
    const ev = await publishSnapshot({ compressedData: "gz:d", stateHash: "h", tick: 5 });
    expect(published).toBe(true);
    expect(ev.kind).toBe(30078);
    expect(JSON.parse(ev.content)).toMatchObject({ tick: 5 });
  });

  it("retries on transient publish errors then throws", async () => {
    let calls = 0;
    mock.state.publishImpl = async () => {
      calls++;
      throw new Error("network timeout");
    };
    await expect(publishSnapshot({ compressedData: "d", stateHash: "h", tick: 1 })).rejects.toThrow(
      "network timeout",
    );
    expect(calls).toBe(3);
  });

  it("does not retry non-transient errors", async () => {
    let calls = 0;
    mock.state.publishImpl = async () => {
      calls++;
      throw new Error("invalid signature");
    };
    await expect(publishSnapshot({ compressedData: "d", stateHash: "h", tick: 1 })).rejects.toThrow(
      "invalid signature",
    );
    expect(calls).toBe(1);
  });
});

describe("snapshot load", () => {
  it("loadSnapshot returns null when no events arrive", async () => {
    mock.state.pageQueue = [[]];
    expect(await loadSnapshot("me")).toBeNull();
  });

  it("loadSnapshot returns the latest valid payload (highest tick, then createdAt)", async () => {
    mock.state.pageQueue = [
      [
        snapEvent({
          id: "a",
          content: JSON.stringify({ compressedData: "d", stateHash: "h", tick: 5 }),
        }),
        snapEvent({
          id: "b",
          content: JSON.stringify({ compressedData: "d", stateHash: "h", tick: 9 }),
        }),
        // malformed content → ignored
        snapEvent({ id: "c", content: "{broken" }),
        // invalid payload (negative tick) → ignored
        snapEvent({
          id: "d",
          content: JSON.stringify({ compressedData: "d", stateHash: "h", tick: -1 }),
        }),
      ],
    ];
    const result = await loadSnapshot("me");
    expect(result?.tick).toBe(9);
  });

  it("loadAllSnapshots groups payloads by author pubkey, keeping latest", async () => {
    mock.state.pageQueue = [
      [
        snapEvent({
          id: "a1",
          author: { pubkey: "sellerA" },
          content: JSON.stringify({ compressedData: "d", stateHash: "h", tick: 3 }),
        }),
        snapEvent({
          id: "a2",
          author: { pubkey: "sellerA" },
          content: JSON.stringify({ compressedData: "d", stateHash: "h", tick: 7 }),
        }),
        snapEvent({
          id: "b1",
          author: { pubkey: "sellerB" },
          content: JSON.stringify({ compressedData: "d", stateHash: "h", tick: 4 }),
        }),
      ],
    ];
    const map = await loadAllSnapshots();
    expect(map.get("sellerA")?.tick).toBe(7);
    expect(map.get("sellerB")?.tick).toBe(4);
  });
});
