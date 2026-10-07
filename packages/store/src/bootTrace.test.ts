import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootMark,
  formatBootTrace,
  getBootTrace,
  resetBootTrace,
  subscribeBootTrace,
} from "./bootTrace";

describe("boot trace", () => {
  afterEach(() => resetBootTrace());

  it("records marks in order with a time and optional detail, and notifies listeners", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBootTrace(listener);
    bootMark("identity: start");
    bootMark("world: synced", "3 rivals");
    unsubscribe();
    bootMark("after");

    const trace = getBootTrace();
    expect(trace.map((m) => m.name)).toEqual(["identity: start", "world: synced", "after"]);
    expect(trace[1].detail).toBe("3 rivals");
    expect(trace[1].at).toBeGreaterThanOrEqual(trace[0].at);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("caps the number of marks", () => {
    for (let i = 0; i < 250; i++) bootMark(`m${i}`);
    expect(getBootTrace()).toHaveLength(200);
  });

  it("formats seconds, names, details and extra lines", () => {
    expect(
      formatBootTrace(
        [
          { name: "a", at: 1500 },
          { name: "b", at: 61234, detail: "x" },
        ],
        ["tail"],
      ),
    ).toBe("   1.50s  a\n  61.23s  b  (x)\ntail");
  });
});
