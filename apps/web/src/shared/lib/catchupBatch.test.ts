import { TICKS_PER_HOUR } from "@acars/core";
import { describe, expect, it } from "vitest";
import { isCatchupBatch } from "./catchupBatch";

describe("isCatchupBatch", () => {
  it("treats live, tick-by-tick updates as normal", () => {
    expect(isCatchupBatch(1000, 1001)).toBe(false);
    expect(isCatchupBatch(1000, 1000 + TICKS_PER_HOUR - 1)).toBe(false);
  });

  it("treats an hour-plus jump or a fresh load as a catch-up", () => {
    expect(isCatchupBatch(1000, 1000 + TICKS_PER_HOUR)).toBe(true);
    expect(isCatchupBatch(null, 5000)).toBe(true);
    expect(isCatchupBatch(undefined, 5000)).toBe(true);
  });
});
