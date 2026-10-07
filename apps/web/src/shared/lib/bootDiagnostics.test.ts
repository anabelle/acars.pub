import { describe, expect, it } from "vitest";
import { isBootTraceRequested, type LongTaskSummary, recordLongTask } from "./bootDiagnostics";

const memory = () => {
  const state = new Map<string, string>();
  return {
    getItem: (key: string) => state.get(key) ?? null,
    setItem: (key: string, value: string) => void state.set(key, value),
  };
};

describe("isBootTraceRequested()", () => {
  it("turns on with ?boot=1, stays on for the tab, and off with ?boot=0", () => {
    const storage = memory();
    expect(isBootTraceRequested("", storage)).toBe(false);
    expect(isBootTraceRequested("?prototype=on&boot=1", storage)).toBe(true);
    expect(isBootTraceRequested("", storage)).toBe(true);
    expect(isBootTraceRequested("?boot=0", storage)).toBe(false);
    expect(isBootTraceRequested("", storage)).toBe(false);
  });

  it("works without storage", () => {
    expect(isBootTraceRequested("?boot=1", null)).toBe(true);
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(isBootTraceRequested("?boot=1", blocked)).toBe(true);
    expect(isBootTraceRequested("", blocked)).toBe(false);
  });
});

describe("recordLongTask()", () => {
  it("counts, totals and remembers the longest task", () => {
    const summary: LongTaskSummary = { count: 0, totalMs: 0, longestMs: 0, longestAt: 0 };
    recordLongTask(summary, 100, 80);
    recordLongTask(summary, 900, 5000);
    recordLongTask(summary, 7000, 60);
    expect(summary).toEqual({ count: 3, totalMs: 5140, longestMs: 5000, longestAt: 900 });
  });
});
