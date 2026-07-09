import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock controller for the NDK subscription layer -------------------------
//
// Each call to ndk.subscribe() returns a sub object whose .on() handlers we
// can drive from the test.  The controller replays a per-page queue of seeded
// events followed by EOSE on the next microtask (after the caller registers
// its handlers synchronously).
//
// vi.mock factories are hoisted above top-level bindings, so all mock state
// lives inside vi.hoisted() and is referenced by the factories via the
// returned object.

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
    ndk: unknown;
    kind: number | undefined;
    tags: string[][] = [];
    content = "";
    id: string;
    created_at: number | undefined;
    author: { pubkey: string } | undefined;
    constructor(ndk: unknown) {
      this.ndk = ndk;
      this.id = `evt-${Math.random().toString(36).slice(2, 8)}`;
    }
    async publish(): Promise<void> {
      return mock.state.publishImpl(this);
    }
  }

  const state = {
    pageQueue: [] as FakeEvent[][],
    publishImpl: async () => {},
    publishedEvents: [] as unknown[],
  };

  const ndkMock = {
    signer: {} as unknown,
    lastSub: null as null | {
      on: (name: string, cb: (...args: unknown[]) => void) => unknown;
      stop: () => void;
      _emit: (name: string, ...args: unknown[]) => void;
    },
    subscribe: () => {
      const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
      const sub = {
        on(name: string, cb: (...args: unknown[]) => void) {
          (handlers[name] ||= []).push(cb);
          return sub;
        },
        stop: () => {},
        _emit(name: string, ...args: unknown[]) {
          for (const cb of handlers[name] || []) cb(...args);
        },
      };
      ndkMock.lastSub = sub;
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

vi.mock("@nostr-dev-kit/ndk", () => ({
  NDKEvent: mock.MockNDKEvent,
}));

import {
  ACTION_KIND,
  buildActionDTag,
  CATALOG_IMAGE_D_PREFIX,
  loadActionLog,
  loadCatalogImages,
  loadCheckpoint,
  loadCheckpoints,
  loadMarketplace,
  MARKETPLACE_D_PREFIX,
  publishAction,
  publishAirline,
  publishCatalogImage,
  publishCheckpoint,
  publishUsedAircraft,
  subscribeActions,
} from "./schema.js";
import type { CatalogImageRecord, Checkpoint } from "./schema.js";

const NOW = Math.floor(Date.now() / 1000);

function makeActionEvent(overrides: Partial<FakeEvent> = {}): FakeEvent {
  return {
    id: overrides.id ?? `act-${Math.random().toString(36).slice(2, 8)}`,
    kind: ACTION_KIND,
    created_at: overrides.created_at ?? NOW,
    tags: overrides.tags ?? [
      ["d", buildActionDTag({ action: "AIRLINE_CREATE", payload: {} })],
      ["world", "v6-beta"],
    ],
    author: overrides.author ?? { pubkey: "seller-pubkey" },
    content:
      overrides.content ??
      JSON.stringify({ schemaVersion: 2, action: "AIRLINE_CREATE", payload: { name: "X" } }),
  };
}

beforeEach(() => {
  mock.state.pageQueue = [];
  mock.state.publishImpl = async () => {};
  mock.state.publishedEvents.length = 0;
  mock.ndkMock.signer = {};
  mock.ndkMock.lastSub = null;
});

describe("schema I/O — publish paths", () => {
  it("publishCatalogImage throws without a signer and succeeds with one", async () => {
    mock.ndkMock.signer = undefined;
    await expect(
      publishCatalogImage({
        modelId: "a320",
        promptHash: "h",
        imageUrl: "u",
        updatedAt: 1,
      } as CatalogImageRecord),
    ).rejects.toThrow("No signer");

    mock.ndkMock.signer = {};
    mock.state.publishImpl = async (ev) => {
      mock.state.publishedEvents.push(ev);
    };
    const event = await publishCatalogImage({
      modelId: "a320",
      promptHash: "h",
      imageUrl: "u",
      updatedAt: 1,
    } as CatalogImageRecord);
    expect(event.kind).toBe(30080);
    expect(mock.state.publishedEvents).toHaveLength(1);
    expect(event.tags).toContainEqual(["model", "a320"]);
  });

  it("publishAction sets kind/tags/content and publishes", async () => {
    mock.state.publishImpl = async (ev) => {
      mock.state.publishedEvents.push(ev);
    };
    const ev = await publishAction({ action: "TICK_UPDATE", payload: { tick: 5 } });
    expect(ev.kind).toBe(ACTION_KIND);
    expect(ev.tags.some((t) => t[0] === "world" && t[1] === "v6-beta")).toBe(true);
    expect(JSON.parse(ev.content)).toMatchObject({ action: "TICK_UPDATE" });
  });

  it("publishAction rejects without a signer", async () => {
    mock.ndkMock.signer = undefined;
    await expect(publishAction({ action: "TICK_UPDATE", payload: {} })).rejects.toThrow(
      "No signer",
    );
  });

  it("publishCheckpoint succeeds on first try", async () => {
    mock.state.publishImpl = async () => {};
    const ev = await publishCheckpoint({} as Checkpoint);
    expect(ev.kind).toBe(ACTION_KIND);
  });

  it("publishCheckpoint retries on transient errors then throws after exhausting", async () => {
    let calls = 0;
    mock.state.publishImpl = async () => {
      calls++;
      throw new Error("network timeout");
    };
    await expect(publishCheckpoint({} as Checkpoint)).rejects.toThrow("network timeout");
    expect(calls).toBe(3); // initial + 2 retries
  });

  it("publishCheckpoint does not retry non-transient errors", async () => {
    let calls = 0;
    mock.state.publishImpl = async () => {
      calls++;
      throw new Error("invalid signature");
    };
    await expect(publishCheckpoint({} as Checkpoint)).rejects.toThrow("invalid signature");
    expect(calls).toBe(1);
  });

  it("publishAirline / loadAirline / loadGlobalAirlines are disabled and throw", async () => {
    await expect(publishAirline()).rejects.toThrow("disabled");
    const { loadAirline, loadGlobalAirlines } = await import("./schema.js");
    await expect(loadAirline()).rejects.toThrow("disabled");
    await expect(loadGlobalAirlines()).rejects.toThrow("disabled");
  });
});

describe("schema I/O — publishUsedAircraft validation", () => {
  it("rejects aircraft missing id / modelId / ownerPubkey", async () => {
    await expect(publishUsedAircraft({} as never, 100)).rejects.toThrow("missing id");
    await expect(publishUsedAircraft({ id: "a1" } as never, 100)).rejects.toThrow(
      "missing modelId",
    );
    await expect(publishUsedAircraft({ id: "a1", modelId: "m" } as never, 100)).rejects.toThrow(
      "missing ownerPubkey",
    );
  });

  it("rejects an invalid price (zero / negative / non-finite)", async () => {
    const ac = { id: "a1", modelId: "m", ownerPubkey: "p" } as never;
    await expect(publishUsedAircraft(ac, 0)).rejects.toThrow("price");
    await expect(publishUsedAircraft(ac, -5)).rejects.toThrow("price");
    await expect(publishUsedAircraft(ac, Number.NaN)).rejects.toThrow("price");
  });

  it("rejects when no signer is attached", async () => {
    mock.ndkMock.signer = undefined;
    await expect(
      publishUsedAircraft({ id: "a1", modelId: "m", ownerPubkey: "p" } as never, 1000),
    ).rejects.toThrow("No signer");
  });

  it("publishes a valid listing", async () => {
    mock.state.publishImpl = async (ev) => {
      mock.state.publishedEvents.push(ev);
    };
    const ev = await publishUsedAircraft(
      { id: "a1", modelId: "m", ownerPubkey: "p" } as never,
      5000,
    );
    expect(ev.kind).toBe(30079);
    expect(mock.state.publishedEvents).toHaveLength(1);
    expect(ev.tags.some((t) => t[0] === "price" && t[1] === "5000")).toBe(true);
  });
});

describe("schema I/O — load paths", () => {
  it("loadActionLog parses valid actions, skips checkpoints/malformed, dedups, sorts", async () => {
    mock.state.pageQueue = [
      [
        makeActionEvent({
          id: "a1",
          created_at: NOW,
          content: JSON.stringify({ schemaVersion: 2, action: "AIRLINE_CREATE", payload: {} }),
        }),
        makeActionEvent({
          id: "a2",
          created_at: NOW - 10,
          // checkpoint d-tag → skipped
          tags: [
            ["d", `airtr:world:v6-beta:checkpoint`],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify({}),
        }),
        makeActionEvent({
          id: "a3",
          created_at: NOW - 5,
          content: "{not-json",
        }),
        makeActionEvent({
          id: "a1", // duplicate id → deduped
          created_at: NOW,
          content: JSON.stringify({ schemaVersion: 2, action: "AIRLINE_CREATE", payload: {} }),
        }),
      ],
    ];
    const log = await loadActionLog();
    expect(log.map((e) => e.event.id)).toEqual(["a1"]); // a2/a3 filtered, a1 deduped
  });

  it("loadActionLog paginates until a short page then returns results", async () => {
    // Two full pages of 2 (pageLimit) then a short page.
    const makeN = (n: number, baseTime: number) =>
      Array.from({ length: n }, (_, i) =>
        makeActionEvent({
          id: `p-${baseTime}-${i}`,
          created_at: baseTime + i,
          content: JSON.stringify({
            schemaVersion: 2,
            action: "TICK_UPDATE",
            payload: { tick: i },
          }),
        }),
      );
    mock.state.pageQueue = [makeN(2, NOW - 100), makeN(2, NOW - 200), makeN(1, NOW - 300)];
    const log = await loadActionLog({ limit: 2, maxPages: 10 });
    expect(log.length).toBe(5);
    // Sorted ascending by created_at
    for (let i = 1; i < log.length; i++) {
      expect(log[i].event.created_at! >= log[i - 1].event.created_at!).toBe(true);
    }
  });

  it("loadActionLog respects authors/since filters by not throwing", async () => {
    mock.state.pageQueue = [[]];
    const log = await loadActionLog({ authors: ["abc"], since: NOW - 50 });
    expect(log).toEqual([]);
  });

  it("loadCatalogImages parses valid catalog records and filters mismatches", async () => {
    mock.state.pageQueue = [
      [
        {
          id: "c1",
          kind: 30080,
          created_at: NOW,
          author: { pubkey: "p" },
          tags: [
            ["d", `${CATALOG_IMAGE_D_PREFIX}a320`],
            ["model", "a320"],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify({
            modelId: "a320",
            promptHash: "h1",
            imageUrl: "url1",
            updatedAt: 1,
          }),
        },
        {
          id: "c2",
          kind: 30080,
          created_at: NOW,
          author: { pubkey: "p" },
          // model tag mismatch with d-tag → skipped
          tags: [
            ["d", `${CATALOG_IMAGE_D_PREFIX}a320`],
            ["model", "b737"],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify({ promptHash: "h", imageUrl: "u" }),
        },
        {
          id: "c3",
          kind: 30080,
          created_at: NOW,
          author: { pubkey: "p" },
          tags: [
            ["d", `${CATALOG_IMAGE_D_PREFIX}b737`],
            ["model", "b737"],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify({ promptHash: "h", imageUrl: "u" }),
        },
      ],
    ];
    const map = await loadCatalogImages();
    expect(map.has("a320")).toBe(true);
    expect(map.has("b737")).toBe(true);
    expect(map.get("a320")?.imageUrl).toBe("url1");
  });

  it("loadCatalogImages keeps the newest record per model within a page", async () => {
    mock.state.pageQueue = [
      [
        {
          id: "old",
          kind: 30080,
          created_at: NOW - 100,
          author: { pubkey: "p" },
          tags: [
            ["d", `${CATALOG_IMAGE_D_PREFIX}a320`],
            ["model", "a320"],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify({ promptHash: "h", imageUrl: "old-url" }),
        },
        {
          id: "new",
          kind: 30080,
          created_at: NOW,
          author: { pubkey: "p" },
          tags: [
            ["d", `${CATALOG_IMAGE_D_PREFIX}a320`],
            ["model", "a320"],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify({ promptHash: "h", imageUrl: "new-url" }),
        },
      ],
    ];
    const map = await loadCatalogImages();
    expect(map.get("a320")?.imageUrl).toBe("new-url");
  });

  it("loadCheckpoint returns the latest valid checkpoint", async () => {
    const cp = {
      schemaVersion: 1,
      tick: 10,
      createdAt: NOW,
      actionChainHash: "ach",
      stateHash: "sh",
      airline: { id: "a" },
      fleet: [],
      routes: [],
      timeline: [],
    };
    mock.state.pageQueue = [
      [
        {
          id: "older",
          kind: ACTION_KIND,
          created_at: NOW,
          author: { pubkey: "me" },
          tags: [
            ["d", "airtr:world:v6-beta:checkpoint"],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify({ ...cp, createdAt: NOW - 50, tick: 5 }),
        },
        {
          id: "newer",
          kind: ACTION_KIND,
          created_at: NOW,
          author: { pubkey: "me" },
          tags: [
            ["d", "airtr:world:v6-beta:checkpoint"],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify(cp),
        },
        {
          id: "malformed",
          kind: ACTION_KIND,
          created_at: NOW,
          author: { pubkey: "me" },
          tags: [
            ["d", "airtr:world:v6-beta:checkpoint"],
            ["world", "v6-beta"],
          ],
          content: "{broken",
        },
      ],
    ];
    const result = await loadCheckpoint("me");
    expect(result?.tick).toBe(10);
  });

  it("loadCheckpoint returns null when nothing valid", async () => {
    mock.state.pageQueue = [[]];
    expect(await loadCheckpoint("me")).toBeNull();
  });

  it("loadCheckpoints returns empty for an empty pubkey list and groups by author otherwise", async () => {
    expect(await loadCheckpoints([])).toEqual(new Map());

    const cp = {
      schemaVersion: 1,
      tick: 1,
      createdAt: NOW,
      actionChainHash: "x",
      stateHash: "y",
      airline: { id: "a" },
      fleet: [],
      routes: [],
      timeline: [],
    };
    mock.state.pageQueue = [
      [
        {
          id: "e1",
          kind: ACTION_KIND,
          created_at: NOW,
          author: { pubkey: "sellerA" },
          tags: [
            ["d", "airtr:world:v6-beta:checkpoint"],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify(cp),
        },
        {
          id: "e2",
          kind: ACTION_KIND,
          created_at: NOW,
          author: { pubkey: "sellerB" },
          tags: [
            ["d", "airtr:world:v6-beta:checkpoint"],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify({ ...cp, tick: 2 }),
        },
      ],
    ];
    const map = await loadCheckpoints(["sellerA", "sellerB"]);
    expect(map.get("sellerA")?.tick).toBe(1);
    expect(map.get("sellerB")?.tick).toBe(2);
  });

  it("loadMarketplace parses, dedups, filters stale via ownership, and sorts", async () => {
    const baseListing = {
      id: "ac-1",
      modelId: "a320",
      ownerPubkey: "seller-pubkey",
      marketplacePrice: 5000,
      name: "A320",
      condition: 0.8,
      configuration: { economy: 150, business: 0, first: 0, cargoKg: 0 },
    };
    mock.state.pageQueue = [
      [
        {
          id: "l1",
          kind: 30079,
          created_at: NOW,
          author: { pubkey: "seller-pubkey" },
          tags: [
            ["d", `${MARKETPLACE_D_PREFIX}ac-1`],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify(baseListing),
        },
        // impersonation: owner in content differs from event author → null
        {
          id: "l2",
          kind: 30079,
          created_at: NOW,
          author: { pubkey: "attacker" },
          tags: [
            ["d", `${MARKETPLACE_D_PREFIX}ac-2`],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify({ ...baseListing, id: "ac-2", ownerPubkey: "victim" }),
        },
        // malformed price → null
        {
          id: "l3",
          kind: 30079,
          created_at: NOW,
          author: { pubkey: "seller-pubkey" },
          tags: [
            ["d", `${MARKETPLACE_D_PREFIX}ac-3`],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify({ ...baseListing, id: "ac-3", marketplacePrice: 0 }),
        },
      ],
    ];
    const listings = await loadMarketplace();
    expect(listings).toHaveLength(1);
    expect(listings[0].instanceId).toBe("ac-1");
  });

  it("loadMarketplace filters stale listings using the seller fleet index", async () => {
    const listing = {
      id: "ac-1",
      modelId: "a320",
      ownerPubkey: "seller-pubkey",
      marketplacePrice: 5000,
    };
    mock.state.pageQueue = [
      [
        {
          id: "l1",
          kind: 30079,
          created_at: NOW,
          author: { pubkey: "seller-pubkey" },
          tags: [
            ["d", `${MARKETPLACE_D_PREFIX}ac-1`],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify(listing),
        },
      ],
    ];
    // seller no longer owns ac-1 → filtered out
    const stale = await loadMarketplace(new Map([["seller-pubkey", new Set(["other-ac"])]]));
    expect(stale).toHaveLength(0);

    mock.state.pageQueue = [
      [
        {
          id: "l1",
          kind: 30079,
          created_at: NOW,
          author: { pubkey: "seller-pubkey" },
          tags: [
            ["d", `${MARKETPLACE_D_PREFIX}ac-1`],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify(listing),
        },
      ],
    ];
    // another airline owns ac-1 now → filtered out
    const bought = await loadMarketplace(
      new Map([
        ["seller-pubkey", new Set(["ac-1"])],
        ["buyer", new Set(["ac-1"])],
      ]),
    );
    expect(bought).toHaveLength(0);

    mock.state.pageQueue = [
      [
        {
          id: "l1",
          kind: 30079,
          created_at: NOW,
          author: { pubkey: "seller-pubkey" },
          tags: [
            ["d", `${MARKETPLACE_D_PREFIX}ac-1`],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify(listing),
        },
      ],
    ];
    // seller still owns it → kept
    const kept = await loadMarketplace(new Map([["seller-pubkey", new Set(["ac-1"])]]));
    expect(kept).toHaveLength(1);
  });
});

describe("schema I/O — subscribeActions", () => {
  it("delivers parsed events, fires onEose, and notifies onClose on unexpected close", async () => {
    const received: string[] = [];
    let eosed = false;
    let closed = false;
    await subscribeActions({
      onEvent: (entry) => received.push(entry.action.action),
      onEose: () => {
        eosed = true;
      },
      onClose: () => {
        closed = true;
      },
    });

    const sub = mock.ndkMock.lastSub!;
    sub._emit(
      "event",
      makeActionEvent({
        content: JSON.stringify({ schemaVersion: 2, action: "TICK_UPDATE", payload: {} }),
      }),
    );
    sub._emit("event", makeActionEvent({ content: "{bad" }));
    sub._emit("eose");
    sub._emit("close");

    expect(received).toEqual(["TICK_UPDATE"]);
    expect(eosed).toBe(true);
    expect(closed).toBe(true);
  });

  it("does not fire onClose when intentionally stopped", async () => {
    let closed = false;
    const stop = await subscribeActions({
      onEvent: () => {},
      onClose: () => {
        closed = true;
      },
    });
    stop(); // intentionally stopped
    mock.ndkMock.lastSub!._emit("close");
    expect(closed).toBe(false);
  });
});
