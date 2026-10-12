import { describe, expect, it } from "vitest";
import { PLANE_NAMES, suggestPlaneName } from "./planeNames";

describe("suggestPlaneName (S61)", () => {
  it("is deterministic for a seed and varies across seeds", () => {
    expect(suggestPlaneName("pubkey:1", [])).toBe(suggestPlaneName("pubkey:1", []));
    const names = new Set(
      Array.from({ length: 20 }, (_, i) => suggestPlaneName(`pubkey:${i}`, [])),
    );
    expect(names.size).toBeGreaterThan(10);
  });

  it("never repeats a name the fleet already uses, ignoring case", () => {
    const first = suggestPlaneName("seed", []);
    const second = suggestPlaneName("seed", [first.toUpperCase()]);
    expect(second).not.toBe(first);
    expect(PLANE_NAMES).toContain(second);
  });

  it("adds a numeral once every name is taken", () => {
    const name = suggestPlaneName("seed", PLANE_NAMES);
    expect(name).toMatch(/ II$/);
    expect(PLANE_NAMES).toContain(name.replace(/ II$/, ""));
  });

  it("has no duplicate or model-like names", () => {
    expect(new Set(PLANE_NAMES).size).toBe(PLANE_NAMES.length);
    for (const name of PLANE_NAMES) expect(name).not.toMatch(/\d/);
  });
});
