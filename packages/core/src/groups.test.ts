import { describe, expect, it } from "vitest";
import { PRICE_ELASTICITY_ECONOMY } from "./demand.js";
import {
  dominantGroup,
  economyElasticity,
  GROUP_ELASTICITY,
  groupAt,
  groupMix,
  PASSENGER_GROUPS,
} from "./groups.js";

describe("passenger groups (S71)", () => {
  it("mixes sum to one for every destination", () => {
    for (const tag of ["beach", "ski", "business", "general", undefined] as const) {
      const mix = groupMix(tag);
      const sum = PASSENGER_GROUPS.reduce((total, group) => total + mix[group], 0);
      expect(sum).toBeCloseTo(1);
    }
    expect(groupMix(undefined)).toEqual(groupMix("general"));
    expect(groupMix("nowhere" as never)).toEqual(groupMix("general"));
  });

  it("keeps general routes at today's economy elasticity", () => {
    expect(economyElasticity(groupMix("general"))).toBeCloseTo(PRICE_ELASTICITY_ECONOMY, 2);
  });

  it("makes holiday routes more price-sensitive and business routes less", () => {
    const beach = economyElasticity(groupMix("beach"));
    const business = economyElasticity(groupMix("business"));
    const general = economyElasticity(groupMix("general"));
    expect(beach).toBeLessThan(general);
    expect(business).toBeGreaterThan(general);
    expect(beach).toBe(-1.37);
    expect(business).toBe(-0.925);
    expect(GROUP_ELASTICITY.business).toBeGreaterThan(GROUP_ELASTICITY.leisure);
  });

  it("names the biggest group", () => {
    expect(dominantGroup(groupMix("beach"))).toBe("leisure");
    expect(dominantGroup(groupMix("business"))).toBe("business");
    expect(dominantGroup(groupMix("general"))).toBe("leisure");
    expect(dominantGroup({ leisure: 0.2, family: 0.2, business: 0.6 })).toBe("business");
  });

  it("picks a group for a seed by the mix's shares", () => {
    const mix = groupMix("general");
    expect(groupAt(mix, 0)).toBe("leisure");
    expect(groupAt(mix, 0.5)).toBe("family");
    expect(groupAt(mix, 0.9)).toBe("business");
    expect(groupAt(mix, 0.99999)).toBe("business");
    expect(groupAt({ leisure: 0, family: 0, business: 0 }, 0.5)).toBe("business");
  });
});
