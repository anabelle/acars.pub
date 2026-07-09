import { describe, expect, it } from "vitest";
import { canonicalRouteKey } from "./route.js";

describe("canonicalRouteKey", () => {
  it("orders IATA codes alphabetically ascending", () => {
    expect(canonicalRouteKey("JFK", "LAX")).toBe("JFK-LAX");
  });

  it("swaps when origin sorts after destination", () => {
    expect(canonicalRouteKey("LAX", "JFK")).toBe("JFK-LAX");
  });

  it("is symmetric — both directions collapse to the same key", () => {
    expect(canonicalRouteKey("BOG", "MDE")).toBe(canonicalRouteKey("MDE", "BOG"));
  });

  it("handles equal codes (degenerate route)", () => {
    expect(canonicalRouteKey("AAA", "AAA")).toBe("AAA-AAA");
  });

  it("uses lexicographic order so lower numeric prefixes sort first", () => {
    expect(canonicalRouteKey("9AA", "1BB")).toBe("1BB-9AA");
  });
});
