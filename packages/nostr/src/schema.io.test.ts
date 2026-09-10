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

  class MockNDKPublishError extends Error {
    constructor(message = "Not enough relays received the event") {
      super(message);
      this.name = "NDKPublishError";
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
    subscribeCallCount: 0,
    subscribe: () => {
      mock.ndkMock.subscribeCallCount += 1;
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

  return { MockNDKEvent, MockNDKPublishError, state, ndkMock };
});

vi.mock("./ndk.js", () => ({
  ensureConnected: vi.fn().mockResolvedValue(undefined),
  getNDK: () => mock.ndkMock,
}));

vi.mock("@nostr-dev-kit/ndk", () => ({
  NDKEvent: mock.MockNDKEvent,
  NDKPublishError: mock.MockNDKPublishError,
}));

import {
  ACTION_KIND,
  buildActionDTag,
  CATALOG_IMAGE_D_PREFIX,
  deleteMarketplaceListing,
  isTransientPublishError,
  loadActionLog,
  loadCatalogImages,
  loadCheckpoint,
  loadCheckpoints,
  loadMarketplace,
  MARKETPLACE_D_PREFIX,
  publishAction,
  publishAirline,
  publishCatalogImage,
  publishUsedAircraft,
  subscribeActions,
} from "./schema.js";
import type { CatalogImageRecord } from "./schema.js";

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
  mock.ndkMock.subscribeCallCount = 0;
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

  it("publishAction retries transient errors then succeeds", async () => {
    let calls = 0;
    mock.state.publishImpl = async () => {
      calls++;
      if (calls < 3) throw new Error("network timeout");
    };
    const ev = await publishAction({ action: "TICK_UPDATE", payload: {} });
    expect(calls).toBe(3);
    expect(ev.kind).toBe(ACTION_KIND);
  });

  it("publishAction retries transient errors then throws after exhausting retries", async () => {
    let calls = 0;
    mock.state.publishImpl = async () => {
      calls++;
      throw new Error("network timeout");
    };
    await expect(publishAction({ action: "TICK_UPDATE", payload: {} })).rejects.toThrow(
      "network timeout",
    );
    expect(calls).toBe(3); // initial + 2 retries
  });

  it("publishAction does not retry non-transient errors", async () => {
    let calls = 0;
    mock.state.publishImpl = async () => {
      calls++;
      throw new Error("invalid signature");
    };
    await expect(publishAction({ action: "TICK_UPDATE", payload: {} })).rejects.toThrow(
      "invalid signature",
    );
    expect(calls).toBe(1);
  });

  it("publishAction treats NDKPublishError instances as transient (instanceof, not constructor.name)", async () => {
    let calls = 0;
    // Simulate a minified build: the error class name is mangled.
    const { NDKPublishError } = await import("@nostr-dev-kit/ndk");
    const mangled = new (NDKPublishError as unknown as new () => Error)();
    Object.defineProperty(mangled, "constructor", {
      value: function MinifiedX() {},
    });
    mock.state.publishImpl = async () => {
      calls++;
      if (calls === 1) throw mangled;
    };
    await publishAction({ action: "TICK_UPDATE", payload: {} });
    expect(calls).toBe(2); // retried once, then succeeded
    expect(isTransientPublishError(mangled)).toBe(true);
  });

  it("structural actions (AIRLINE_CREATE / AIRLINE_DISSOLVE) publish WITHOUT expiration", async () => {
    mock.state.publishImpl = async (ev) => {
      mock.state.publishedEvents.push(ev);
    };
    for (const action of ["AIRLINE_CREATE", "AIRLINE_DISSOLVE"] as const) {
      const ev = await publishAction({ action, payload: {} });
      expect(ev.tags.some((t) => t[0] === "expiration")).toBe(false);
    }
  });

  it("regular actions (TICK_UPDATE, purchases) publish WITH a ~14-day expiration", async () => {
    mock.state.publishImpl = async (ev) => {
      mock.state.publishedEvents.push(ev);
    };
    const now = Math.floor(Date.now() / 1000);
    for (const action of ["TICK_UPDATE", "AIRCRAFT_PURCHASE"] as const) {
      const ev = await publishAction({ action, payload: {} });
      const expTag = ev.tags.find((t) => t[0] === "expiration")?.[1];
      expect(expTag).toBeDefined();
      const exp = Number(expTag);
      // 14 days ± 1h of scheduling slack
      expect(exp).toBeGreaterThan(now + 13 * 24 * 3600);
      expect(exp).toBeLessThan(now + 15 * 24 * 3600);
    }
  });

  it("publishCheckpoint no longer exists as public API (dead code removed)", async () => {
    const schema = await import("./schema.js");
    expect((schema as Record<string, unknown>).publishCheckpoint).toBeUndefined();
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

  it("serializes ONLY listing fields (no live flight/route state)", async () => {
    let captured: string | undefined;
    mock.state.publishImpl = async (ev) => {
      captured = ev.content;
    };
    const fullAircraft = {
      id: "a1",
      modelId: "a320",
      ownerPubkey: "seller",
      name: "Nifty A320",
      condition: 0.9,
      flightHoursTotal: 1200,
      flightHoursSinceCheck: 30,
      birthTick: 100,
      purchasedAtTick: 200,
      purchasePrice: 9000000,
      purchaseType: "buy",
      baseAirportIata: "BOG",
      configuration: { economy: 150, business: 20, first: 0, cargoKg: 0 },
      // Live operational state that must NOT leak into the listing event:
      flight: { departureTick: 1, arrivalTick: 2 },
      assignedRouteId: "route-7",
      status: "enroute",
      turnaroundEndTick: 42,
    };
    await publishUsedAircraft(fullAircraft as never, 5000);
    const payload = JSON.parse(captured!);
    expect(payload).toMatchObject({
      id: "a1",
      modelId: "a320",
      ownerPubkey: "seller",
      baseAirportIata: "BOG",
      condition: 0.9,
      marketplacePrice: 5000,
    });
    expect(typeof payload.listedAt).toBe("number");
    expect(payload.flight).toBeUndefined();
    expect(payload.assignedRouteId).toBeUndefined();
    expect(payload.status).toBeUndefined();
    expect(payload.turnaroundEndTick).toBeUndefined();
  });
});

describe("schema I/O — deleteMarketplaceListing (NIP-09)", () => {
  it("publishes a kind-5 deletion with an `a` tag for the parameterized listing", async () => {
    mock.state.publishImpl = async (ev) => {
      mock.state.publishedEvents.push(ev);
    };
    const ev = await deleteMarketplaceListing("seller-pk", "ac-1");
    expect(ev.kind).toBe(5);
    expect(ev.tags).toContainEqual(["a", `30079:seller-pk:${MARKETPLACE_D_PREFIX}ac-1`]);
    expect(ev.tags.some((t) => t[0] === "k" && t[1] === "30079")).toBe(true);
  });

  it("rejects invalid arguments", async () => {
    await expect(deleteMarketplaceListing("", "ac-1")).rejects.toThrow("seller pubkey");
    await expect(deleteMarketplaceListing("seller-pk", "")).rejects.toThrow("aircraftId");
  });

  it("rejects when no signer is attached", async () => {
    mock.ndkMock.signer = undefined;
    await expect(deleteMarketplaceListing("seller-pk", "ac-1")).rejects.toThrow("No signer");
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

  it("loadActionLog pages on RAW events — 60% garbage does not truncate the log", async () => {
    // Page 1: 5 raw events (full page) but only 2 parse (60% garbage).
    // The old post-filter break (pageResults.length < pageLimit) stopped here
    // and hid older actions; pagination must continue on the raw count.
    const valid = (id: string, created: number) =>
      makeActionEvent({
        id,
        created_at: created,
        content: JSON.stringify({ schemaVersion: 2, action: "TICK_UPDATE", payload: { tick: 1 } }),
      });
    const garbage = (created: number) =>
      makeActionEvent({
        created_at: created,
        // Valid kind/world/d-tag but unparseable content → filtered post-fetch
        content: "{garbage",
      });
    mock.state.pageQueue = [
      [
        valid("v1", NOW - 10),
        garbage(NOW - 11),
        garbage(NOW - 12),
        garbage(NOW - 13),
        valid("v2", NOW - 14),
      ],
      [
        valid("v3", NOW - 50),
        valid("v4", NOW - 51),
        garbage(NOW - 52),
        garbage(NOW - 53),
        garbage(NOW - 54),
      ],
      [valid("v5", NOW - 100)], // short raw page → stop
    ];
    const log = await loadActionLog({ limit: 5, maxPages: 10 });
    // Ascending by created_at: v5(-100) < v4(-51) < v3(-50) < v2(-14) < v1(-10)
    expect(log.map((e) => e.event.id)).toEqual(["v5", "v4", "v3", "v2", "v1"]);
  });

  it("loadActionLog skips oversized payloads (>128KB) without dying", async () => {
    const oversized = makeActionEvent({
      id: "big",
      content: JSON.stringify({
        schemaVersion: 2,
        action: "TICK_UPDATE",
        payload: { pad: "x".repeat(140 * 1024) },
      }),
    });
    const normal = makeActionEvent({
      id: "ok",
      content: JSON.stringify({ schemaVersion: 2, action: "TICK_UPDATE", payload: { tick: 1 } }),
    });
    mock.state.pageQueue = [[oversized, normal]];
    const log = await loadActionLog();
    expect(log.map((e) => e.event.id)).toEqual(["ok"]);
  });

  it("loadActionLog caps retained events per author at 2000", async () => {
    const author = { pubkey: "spammer" };
    const mk = (i: number) =>
      makeActionEvent({
        id: `s-${i}`,
        created_at: NOW - i,
        author,
        content: JSON.stringify({ schemaVersion: 2, action: "TICK_UPDATE", payload: { tick: i } }),
      });
    // 3 pages × 1000 = 3000 valid events from one author → capped at 2000.
    mock.state.pageQueue = [
      Array.from({ length: 1000 }, (_, i) => mk(i)),
      Array.from({ length: 1000 }, (_, i) => mk(1000 + i)),
      Array.from({ length: 1000 }, (_, i) => mk(2000 + i)),
    ];
    const log = await loadActionLog({ limit: 1000, maxPages: 10 });
    expect(log).toHaveLength(2000);
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

  it("loadCheckpoints partitions authors into relay-safe batches of ≤200 with fan-in", async () => {
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
    const cpEvent = (pubkey: string, tick: number) => ({
      id: `cp-${pubkey}`,
      kind: ACTION_KIND,
      created_at: NOW,
      author: { pubkey },
      tags: [
        ["d", "airtr:world:v6-beta:checkpoint"],
        ["world", "v6-beta"],
      ],
      content: JSON.stringify({ ...cp, tick }),
    });

    // 450 pubkeys → ceil(450/200) = 3 batches/subscriptions.
    const pubkeys = Array.from({ length: 450 }, (_, i) => `pk-${i}`);
    mock.state.pageQueue = [
      [cpEvent("pk-0", 1), cpEvent("pk-199", 2)],
      [cpEvent("pk-200", 3)],
      [cpEvent("pk-449", 4)],
    ];
    const map = await loadCheckpoints(pubkeys);

    expect(mock.ndkMock.subscribeCallCount).toBe(3);
    expect(map.size).toBe(4);
    expect(map.get("pk-0")?.tick).toBe(1);
    expect(map.get("pk-199")?.tick).toBe(2);
    expect(map.get("pk-200")?.tick).toBe(3);
    expect(map.get("pk-449")?.tick).toBe(4);
  });

  it("loadMarketplace parses, dedups, filters stale via ownership, and sorts", async () => {
    const baseListing = {
      id: "ac-1",
      modelId: "a320",
      ownerPubkey: "seller-pubkey",
      marketplacePrice: 5000,
      name: "A320",
      condition: 0.8,
      baseAirportIata: "BOG",
      listedAt: NOW,
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

  it("loadMarketplace skips listings missing critical fields (strict parsing, no fabricated defaults)", async () => {
    const valid = {
      id: "ac-ok",
      modelId: "a320",
      ownerPubkey: "seller-pubkey",
      marketplacePrice: 5000,
      name: "A320",
      condition: 0.8,
      baseAirportIata: "BOG",
      listedAt: NOW,
    };
    const mk = (id: string, overrides: Record<string, unknown>) => ({
      id,
      kind: 30079,
      created_at: NOW,
      author: { pubkey: "seller-pubkey" },
      tags: [
        ["d", `${MARKETPLACE_D_PREFIX}${id}`],
        ["world", "v6-beta"],
      ],
      content: JSON.stringify({ ...valid, id, ...overrides }),
    });
    mock.state.pageQueue = [
      [
        mk("ac-ok", {}),
        mk("ac-no-name", { name: undefined }),
        mk("ac-no-hub", { baseAirportIata: undefined }),
        mk("ac-no-condition", { condition: undefined }),
        mk("ac-no-listedat", { listedAt: undefined }),
      ],
    ];
    const listings = await loadMarketplace();
    expect(listings).toHaveLength(1);
    expect(listings[0].instanceId).toBe("ac-ok");
  });

  it("loadMarketplace clamps flightHoursTotal and birthTick to 1e9", async () => {
    const listing = {
      id: "ac-clamp",
      modelId: "a320",
      ownerPubkey: "seller-pubkey",
      marketplacePrice: 5000,
      name: "A320",
      condition: 0.8,
      baseAirportIata: "BOG",
      listedAt: NOW,
      flightHoursTotal: Number.MAX_SAFE_INTEGER,
      birthTick: 5e15,
    };
    mock.state.pageQueue = [
      [
        {
          id: "l1",
          kind: 30079,
          created_at: NOW,
          author: { pubkey: "seller-pubkey" },
          tags: [
            ["d", `${MARKETPLACE_D_PREFIX}ac-clamp`],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify(listing),
        },
      ],
    ];
    const [parsed] = await loadMarketplace();
    expect(parsed.flightHoursTotal).toBe(1e9);
    expect(parsed.birthTick).toBe(1e9);
  });

  it("loadMarketplace filters stale listings using the seller fleet index", async () => {
    const listing = {
      id: "ac-1",
      modelId: "a320",
      ownerPubkey: "seller-pubkey",
      marketplacePrice: 5000,
      name: "A320",
      condition: 0.9,
      baseAirportIata: "BOG",
      listedAt: NOW,
    };
    const page = () => [
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
    ];
    mock.state.pageQueue = [page()];
    // seller no longer owns ac-1 → filtered out
    const stale = await loadMarketplace(new Map([["seller-pubkey", new Set(["other-ac"])]]));
    expect(stale).toHaveLength(0);

    mock.state.pageQueue = [page()];
    // another airline owns ac-1 now → filtered out
    const bought = await loadMarketplace(
      new Map([
        ["seller-pubkey", new Set(["ac-1"])],
        ["buyer", new Set(["ac-1"])],
      ]),
    );
    expect(bought).toHaveLength(0);

    mock.state.pageQueue = [page()];
    // seller still owns it → kept
    const kept = await loadMarketplace(new Map([["seller-pubkey", new Set(["ac-1"])]]));
    expect(kept).toHaveLength(1);
  });

  it("loadMarketplace flags old listings from unknown sellers as staleUnknownSeller", async () => {
    const listing = {
      id: "ac-old",
      modelId: "a320",
      ownerPubkey: "ghost-seller",
      marketplacePrice: 5000,
      name: "A320",
      condition: 0.9,
      baseAirportIata: "BOG",
      listedAt: NOW - 7200,
    };
    mock.state.pageQueue = [
      [
        {
          id: "l-old",
          kind: 30079,
          created_at: NOW - 7200, // 2h old — past the 3600s TTL
          author: { pubkey: "ghost-seller" },
          tags: [
            ["d", `${MARKETPLACE_D_PREFIX}ac-old`],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify(listing),
        },
        {
          id: "l-fresh",
          kind: 30079,
          created_at: NOW - 60, // 1min old — fresh, keep unflagged
          author: { pubkey: "ghost-seller" },
          tags: [
            ["d", `${MARKETPLACE_D_PREFIX}ac-fresh`],
            ["world", "v6-beta"],
          ],
          content: JSON.stringify({ ...listing, id: "ac-fresh", listedAt: NOW - 60 }),
        },
      ],
    ];
    // Fleet index exists (some other seller) but ghost-seller is unknown.
    const results = await loadMarketplace(new Map([["other-seller", new Set(["x"])]]));
    const old = results.find((l) => l.instanceId === "ac-old");
    const fresh = results.find((l) => l.instanceId === "ac-fresh");
    expect(old?.staleUnknownSeller).toBe(true);
    expect(fresh?.staleUnknownSeller).toBeUndefined();
  });

  it("loadMarketplace paginates across full raw pages instead of a single 100-event window", async () => {
    const mkListingEvent = (i: number) => ({
      id: `mkt-${i}`,
      kind: 30079,
      created_at: NOW - i,
      author: { pubkey: `seller-${i}` },
      tags: [
        ["d", `${MARKETPLACE_D_PREFIX}ac-${i}`],
        ["world", "v6-beta"],
      ],
      content: JSON.stringify({
        id: `ac-${i}`,
        modelId: "a320",
        ownerPubkey: `seller-${i}`,
        marketplacePrice: 100 + i,
        name: "A320",
        condition: 0.8,
        baseAirportIata: "BOG",
        listedAt: NOW - i,
      }),
    });
    // Page 1: exactly 100 raw events (full page → must paginate).
    // Page 2: 2 events (short page → stop).
    mock.state.pageQueue = [
      Array.from({ length: 100 }, (_, i) => mkListingEvent(i)),
      [mkListingEvent(100), mkListingEvent(101)],
    ];
    const listings = await loadMarketplace();
    expect(listings.length).toBe(102);
    expect(mock.ndkMock.subscribeCallCount).toBe(2);
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
