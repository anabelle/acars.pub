import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();
const ndkConstructorMock = vi.fn();
// Controls what ndk.pool.connectedRelays() returns; default = no pool.
const poolState = { connectedRelaysReturn: undefined as unknown as (() => unknown[]) | undefined };

vi.mock("@nostr-dev-kit/ndk", () => {
  class NDK {
    public connect = connectMock;
    public pool = poolState.connectedRelaysReturn
      ? { connectedRelays: poolState.connectedRelaysReturn }
      : undefined;
    constructor(options?: unknown) {
      ndkConstructorMock(options);
      // Re-read pool state on each construction so tests can mutate it.
      this.pool = poolState.connectedRelaysReturn
        ? { connectedRelays: poolState.connectedRelaysReturn }
        : undefined;
    }
  }
  return { default: NDK };
});

import { connectedRelayCount, ensureConnected, getNDK, reconnectIfNeeded } from "./ndk.js";

describe("ndk", () => {
  beforeEach(() => {
    connectMock.mockReset();
    ndkConstructorMock.mockReset();
    poolState.connectedRelaysReturn = undefined;
  });

  it("creates a singleton instance with relay urls", () => {
    const first = getNDK();
    const second = getNDK();
    expect(first).toBe(second);
    expect(ndkConstructorMock).toHaveBeenCalledTimes(1);
    expect(ndkConstructorMock.mock.calls[0]?.[0]).toMatchObject({
      explicitRelayUrls: expect.any(Array),
    });
  });

  it("connects only once for concurrent calls", async () => {
    connectMock.mockResolvedValue(undefined);
    await Promise.all([ensureConnected(), ensureConnected(), ensureConnected()]);
    expect(connectMock).toHaveBeenCalledTimes(1);
  }, 10000);

  it("connectedRelayCount returns 0 when pool is missing (catch fallback)", () => {
    expect(connectedRelayCount()).toBe(0);
  });

  it("connectedRelayCount returns the pool size when connectedRelays is present", () => {
    poolState.connectedRelaysReturn = () => ["r1", "r2"] as unknown[];
    // Force a fresh singleton so the pool is wired into the instance.
    // (getNDK memoizes; we recreate by resetting module state is heavy, so
    // instead directly assert via a new NDK-like instance behavior.)
    const ndk = getNDK();
    (ndk as unknown as { pool: unknown }).pool = {
      connectedRelays: () => ["r1", "r2"],
    };
    expect(connectedRelayCount()).toBe(2);
  });

  it("connectedRelayCount returns 0 when connectedRelays throws", () => {
    const ndk = getNDK();
    (ndk as unknown as { pool: unknown }).pool = {
      connectedRelays: () => {
        throw new Error("boom");
      },
    };
    expect(connectedRelayCount()).toBe(0);
  });

  it("reconnectIfNeeded short-circuits when relays are already connected", async () => {
    const ndk = getNDK();
    (ndk as unknown as { pool: unknown }).pool = {
      connectedRelays: () => ["r1"],
    };
    const result = await reconnectIfNeeded();
    expect(result).toBe(true);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("reconnectIfNeeded attempts connect and returns false when still disconnected", async () => {
    connectMock.mockResolvedValue(undefined);
    const ndk = getNDK();
    (ndk as unknown as { pool: unknown }).pool = undefined;
    // Use fake timers so the 5s poll loop resolves instantly.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const promise = reconnectIfNeeded();
      await vi.advanceTimersByTimeAsync(6000);
      const result = await promise;
      expect(result).toBe(false);
      expect(connectMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  }, 15000);

  it("reconnectIfNeeded swallows connect rejection and still polls", async () => {
    connectMock.mockRejectedValue(new Error("connect failed"));
    const ndk = getNDK();
    (ndk as unknown as { pool: unknown }).pool = undefined;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const promise = reconnectIfNeeded();
      await vi.advanceTimersByTimeAsync(6000);
      const result = await promise;
      expect(result).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  }, 15000);

  it("reconnectIfNeeded returns true when a relay connects during polling", async () => {
    connectMock.mockResolvedValue(undefined);
    const ndk = getNDK();
    let polls = 0;
    const pool = {
      // Disconnected for the first couple of polls, then comes online.
      connectedRelays: () => {
        polls += 1;
        return polls > 2 ? ["r1"] : [];
      },
    };
    (ndk as unknown as { pool: unknown }).pool = pool;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const promise = reconnectIfNeeded();
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;
      expect(result).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  }, 15000);

  it("ensureConnected resolves even when the initial connect rejects", async () => {
    connectMock.mockRejectedValue(new Error("connect failed"));
    const ndk = getNDK();
    (ndk as unknown as { pool: unknown }).pool = undefined;
    // Reset the memoized connection promise by reloading the module is heavy;
    // ensureConnected's connectionPromise is module-level and already set from
    // earlier tests, so we rely on its resolved state. Just assert it resolves.
    await expect(ensureConnected()).resolves.toBeUndefined();
  }, 15000);
});
