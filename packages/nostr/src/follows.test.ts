import { describe, expect, it, vi } from "vitest";

const ME = "a".repeat(64);
const events: object[] = [];

vi.mock("./ndk.js", () => ({
  ensureConnected: vi.fn().mockResolvedValue(undefined),
  getNDK: () => ({
    subscribe: () => {
      const handlers: Record<string, (value?: unknown) => void> = {};
      queueMicrotask(() => {
        for (const raw of events) handlers.event?.({ rawEvent: () => raw });
        handlers.eose?.();
      });
      return {
        on: (name: string, fn: (value?: unknown) => void) => {
          handlers[name] = fn;
        },
        stop: vi.fn(),
      };
    },
  }),
}));

import { loadFollows } from "./follows";

describe("loadFollows (S74)", () => {
  it("reads the newest contact list's people", async () => {
    events.push(
      { pubkey: ME, kind: 3, created_at: 1, tags: [["p", "b".repeat(64)]] },
      {
        pubkey: ME,
        kind: 3,
        created_at: 2,
        tags: [["p", "c".repeat(64)], ["p", "not-a-key"], ["t", "x"], ["p"]],
      },
      { pubkey: "d".repeat(64), kind: 3, created_at: 9, tags: [["p", "e".repeat(64)]] },
      { pubkey: ME, kind: 1, created_at: 9, tags: [["p", "f".repeat(64)]] },
    );
    expect([...(await loadFollows(ME))]).toEqual(["c".repeat(64)]);
  });

  it("is empty for a bad key or nobody followed", async () => {
    expect((await loadFollows("nope")).size).toBe(0);
    events.length = 0;
    expect((await loadFollows(ME)).size).toBe(0);
  });
});
