import { describe, expect, it } from "vitest";
import { computeRejectedBuyEventIds } from "./marketplaceReplay.js";
import type { ActionLogEntry } from "@acars/nostr";

function buyEntry(id: string, instanceId: unknown, createdAt: number): ActionLogEntry {
  return {
    event: { id, created_at: createdAt, author: { pubkey: "p" } } as never,
    action: {
      schemaVersion: 2,
      action: "AIRCRAFT_BUY_USED",
      payload: { instanceId },
    } as never,
  };
}

function otherEntry(id: string, action: string): ActionLogEntry {
  return {
    event: { id, created_at: 1, author: { pubkey: "p" } } as never,
    action: { schemaVersion: 2, action, payload: {} } as never,
  };
}

describe("computeRejectedBuyEventIds", () => {
  it("returns an empty set when there are no buy events", () => {
    expect(computeRejectedBuyEventIds([otherEntry("a1", "AIRLINE_CREATE")])).toEqual(new Set());
  });

  it("ignores buy events with a missing or blank instanceId", () => {
    const entries = [
      buyEntry("b1", undefined, 10),
      buyEntry("b2", "", 11),
      buyEntry("b3", "   ", 12),
    ];
    expect(computeRejectedBuyEventIds(entries)).toEqual(new Set());
  });

  it("returns an empty set when each aircraft is bought only once", () => {
    const entries = [buyEntry("b1", "ac-1", 10), buyEntry("b2", "ac-2", 11)];
    expect(computeRejectedBuyEventIds(entries)).toEqual(new Set());
  });

  it("rejects all but the earliest buy for a duplicate instanceId", () => {
    const entries = [
      buyEntry("first", "ac-1", 100),
      buyEntry("second", "ac-1", 200),
      buyEntry("third", "ac-1", 150),
    ];
    // Sorted by createdAt: first(100), third(150), second(200) → reject third + second.
    expect(computeRejectedBuyEventIds(entries)).toEqual(new Set(["second", "third"]));
  });

  it("breaks ties on equal createdAt by event id (localeCompare)", () => {
    const entries = [
      buyEntry("zzz", "ac-1", 100),
      buyEntry("aaa", "ac-1", 100),
      buyEntry("mmm", "ac-1", 100),
    ];
    // Same timestamp → sort by id ascending: aaa, mmm, zzz → reject mmm + zzz.
    expect(computeRejectedBuyEventIds(entries)).toEqual(new Set(["mmm", "zzz"]));
  });

  it("handles collisions across instanceIds independently", () => {
    const entries = [
      buyEntry("a1", "ac-1", 10),
      buyEntry("a2", "ac-1", 20), // rejected (dup ac-1)
      buyEntry("b1", "ac-2", 5),
      buyEntry("c1", "ac-3", 7),
    ];
    expect(computeRejectedBuyEventIds(entries)).toEqual(new Set(["a2"]));
  });

  it("uses 0 for missing created_at during sort", () => {
    const entries = [buyEntry("late", "ac-1", 200), buyEntry("unknown", "ac-1", undefined)];
    // undefined created_at → treated as 0 → earliest → kept; late rejected.
    expect(computeRejectedBuyEventIds(entries)).toEqual(new Set(["late"]));
  });
});
