import { describe, expect, it } from "vitest";
import {
  canonicalize,
  computeActionChainHash,
  computeCheckpointStateHash,
  verifyCheckpoint,
} from "./checkpoint.js";
import { fp } from "./fixed-point.js";

describe("crypto.subtle unavailable", () => {
  const originalDigest = globalThis.crypto?.subtle?.digest;

  it("throws when crypto.subtle.digest is missing", async () => {
    // Temporarily remove digest so the defensive guard fires.
    const subtle = globalThis.crypto!.subtle!;
    const saved = subtle.digest;
    // @ts-expect-error — intentionally deleting for the test
    subtle.digest = undefined;
    try {
      await expect(computeActionChainHash("", { id: "x" })).rejects.toThrow(
        "crypto.subtle is not available",
      );
    } finally {
      subtle.digest = saved;
    }
    expect(originalDigest).toBeDefined();
  });
});

describe("checkpoint hashing", () => {
  it("computes stable action chain hashes", async () => {
    const action = {
      schemaVersion: 2,
      action: "AIRLINE_CREATE",
      payload: { name: "Test Air", tick: 1 },
    };

    const first = await computeActionChainHash("", { id: "evt-1", action });
    const second = await computeActionChainHash("", { id: "evt-1", action });
    expect(first).toBe(second);
  });

  it("hashes derived state deterministically", async () => {
    const airline = {
      id: "airline-1",
      foundedBy: "pubkey-1",
      status: "private" as const,
      ceoPubkey: "pubkey-1",
      sharesOutstanding: 10000000,
      shareholders: { "pubkey-1": 10000000 },
      name: "Test Air",
      icaoCode: "TST",
      callsign: "TEST",
      hubs: ["JFK"],
      livery: { primary: "#000000", secondary: "#111111", accent: "#222222" },
      brandScore: 0.5,
      tier: 1,
      cumulativeRevenue: fp(0),
      corporateBalance: 100000000,
      stockPrice: 100000,
      fleetIds: [],
      routeIds: [],
      lastTick: 1,
    };

    const first = await computeCheckpointStateHash({
      airline,
      fleet: [],
      routes: [],
      timeline: [],
    });
    const second = await computeCheckpointStateHash({
      airline,
      fleet: [],
      routes: [],
      timeline: [],
    });
    expect(first).toBe(second);
  });

  it("canonicalize sorts object keys deterministically", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("canonicalize drops undefined values and recurses into arrays/objects", () => {
    expect(canonicalize({ a: undefined, b: { d: undefined, c: 1 }, e: [2, 1] })).toBe(
      '{"b":{"c":1},"e":[2,1]}',
    );
  });

  it("state hash is order-independent (sorts fleet/routes/timeline)", async () => {
    const airline = {
      id: "airline-1",
      foundedBy: "pubkey-1",
      status: "private" as const,
      ceoPubkey: "pubkey-1",
      sharesOutstanding: 10000000,
      shareholders: { "pubkey-1": 10000000 },
      name: "Test Air",
      icaoCode: "TST",
      callsign: "TEST",
      hubs: ["JFK"],
      livery: { primary: "#000", secondary: "#111", accent: "#222" },
      brandScore: 0.5,
      tier: 1,
      cumulativeRevenue: fp(0),
      corporateBalance: 100000000,
      stockPrice: 100000,
      fleetIds: [],
      routeIds: [],
      lastTick: 1,
    };
    const fleet = [
      { id: "ac-2", purchasePrice: fp(10) } as never,
      { id: "ac-1", purchasePrice: fp(20) } as never,
    ];
    const routes = [{ id: "r-2" } as never, { id: "r-1" } as never];
    // Same tick, different ids — exercises the code-unit tie-break branch.
    // Plus a different-tick entry to exercise the tick-differ branch.
    const timeline = [
      { id: "tl-b", tick: 5 } as never,
      { id: "tl-a", tick: 5 } as never,
      { id: "tl-c", tick: 9 } as never,
    ];

    const unordered = await computeCheckpointStateHash({ airline, fleet, routes, timeline });
    const ordered = await computeCheckpointStateHash({
      airline,
      fleet: [...fleet].reverse(),
      routes: [...routes].reverse(),
      timeline: [...timeline].reverse(),
    });
    expect(unordered).toBe(ordered);
  });

  it("verifyCheckpoint returns false on a mismatched action chain hash", async () => {
    const airline = {
      id: "airline-1",
      foundedBy: "p",
      status: "private" as const,
      ceoPubkey: "p",
      sharesOutstanding: 1,
      shareholders: { p: 1 },
      name: "A",
      icaoCode: "TST",
      callsign: "TEST",
      hubs: [],
      livery: { primary: "#0", secondary: "#1", accent: "#2" },
      brandScore: 0.5,
      tier: 1,
      cumulativeRevenue: fp(0),
      corporateBalance: 0,
      stockPrice: 0,
      fleetIds: [],
      routeIds: [],
      lastTick: 0,
    };
    const stateHash = await computeCheckpointStateHash({
      airline,
      fleet: [],
      routes: [],
      timeline: [],
    });
    const result = await verifyCheckpoint({
      actionChainHash: "aaa",
      expectedActionChainHash: "bbb",
      expectedStateHash: stateHash,
      airline,
      fleet: [],
      routes: [],
      timeline: [],
    });
    expect(result).toBe(false);
  });

  it("verifyCheckpoint validates a correct chain + state hash", async () => {
    const airline = {
      id: "airline-1",
      foundedBy: "p",
      status: "private" as const,
      ceoPubkey: "p",
      sharesOutstanding: 1,
      shareholders: { p: 1 },
      name: "A",
      icaoCode: "TST",
      callsign: "TEST",
      hubs: [],
      livery: { primary: "#0", secondary: "#1", accent: "#2" },
      brandScore: 0.5,
      tier: 1,
      cumulativeRevenue: fp(0),
      corporateBalance: 0,
      stockPrice: 0,
      fleetIds: [],
      routeIds: [],
      lastTick: 0,
    };
    const expectedStateHash = await computeCheckpointStateHash({
      airline,
      fleet: [],
      routes: [],
      timeline: [],
    });
    const result = await verifyCheckpoint({
      actionChainHash: "chain-x",
      expectedActionChainHash: "chain-x",
      expectedStateHash,
      airline,
      fleet: [],
      routes: [],
      timeline: [],
    });
    expect(result).toBe(true);
  });
});
