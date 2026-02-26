import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("handles conditional values", () => {
    const conditional = Math.random() > 1 ? "hidden" : undefined;
    expect(cn("text-sm", conditional, undefined, "px-2")).toBe("text-sm px-2");
  });
});
