import { describe, expect, it } from "vitest";
import { AsyncMutex } from "./asyncMutex.js";

describe("AsyncMutex", () => {
  it("acquires the lock on the first tryLock()", () => {
    const m = new AsyncMutex();
    expect(m.tryLock()).toBe(true);
    expect(m.isLocked).toBe(true);
  });

  it("rejects a second tryLock() while held (non-reentrant)", () => {
    const m = new AsyncMutex();
    expect(m.tryLock()).toBe(true);
    expect(m.tryLock()).toBe(false);
  });

  it("releases the lock with unlock()", () => {
    const m = new AsyncMutex();
    m.tryLock();
    m.unlock();
    expect(m.isLocked).toBe(false);
    expect(m.tryLock()).toBe(true);
  });

  it("unlock() is safe to call when not held", () => {
    const m = new AsyncMutex();
    expect(() => m.unlock()).not.toThrow();
    expect(m.isLocked).toBe(false);
  });

  it("reset() force-clears the lock for test teardown", () => {
    const m = new AsyncMutex();
    m.tryLock();
    m.reset();
    expect(m.isLocked).toBe(false);
  });

  it("reports isLocked=false on a fresh instance", () => {
    expect(new AsyncMutex().isLocked).toBe(false);
  });
});
