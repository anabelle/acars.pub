import { GENESIS_TIME, TICK_DURATION, TICKS_PER_HOUR } from "@acars/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CAUGHT_UP_TOLERANCE_TICKS,
  decideAwayReport,
  readLastSeenTick,
  wallClockTick,
  writeLastSeenTick,
} from "./lastSeen";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("decideAwayReport", () => {
  const wallTick = 1_000_000;

  it("waits until the airline is loaded and caught up with the clock", () => {
    expect(decideAwayReport({ lastSeenTick: 0, simulatedTick: null, wallTick })).toEqual({
      kind: "wait",
    });
    expect(
      decideAwayReport({
        lastSeenTick: 0,
        simulatedTick: wallTick - CAUGHT_UP_TOLERANCE_TICKS - 1,
        wallTick,
      }),
    ).toEqual({ kind: "wait" });
  });

  it("reports an absence of an hour or more, from last seen to now", () => {
    const lastSeenTick = wallTick - 12 * TICKS_PER_HOUR;
    expect(decideAwayReport({ lastSeenTick, simulatedTick: wallTick, wallTick })).toEqual({
      kind: "report",
      fromTick: lastSeenTick,
      toTick: wallTick,
    });
  });

  it("stays silent for short absences and first visits", () => {
    expect(
      decideAwayReport({
        lastSeenTick: wallTick - TICKS_PER_HOUR + 1,
        simulatedTick: wallTick,
        wallTick,
      }),
    ).toEqual({ kind: "none" });
    expect(decideAwayReport({ lastSeenTick: null, simulatedTick: wallTick, wallTick })).toEqual({
      kind: "none",
    });
  });
});

describe("last-seen storage", () => {
  it("round-trips per pubkey", () => {
    writeLastSeenTick("alice", 1234.7);
    expect(readLastSeenTick("alice")).toBe(1234);
    expect(readLastSeenTick("bob")).toBeNull();
  });

  it("ignores garbage and survives blocked storage", () => {
    window.localStorage.setItem("acars:lastSeenTick:alice", "not-a-number");
    expect(readLastSeenTick("alice")).toBeNull();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(readLastSeenTick("alice")).toBeNull();
    expect(() => writeLastSeenTick("alice", 1)).not.toThrow();
  });
});

it("wallClockTick matches the engine clock", () => {
  expect(wallClockTick(GENESIS_TIME + 10 * TICK_DURATION + 1)).toBe(10);
  expect(wallClockTick(GENESIS_TIME - 1)).toBe(0);
});
