import { describe, expect, it } from "vitest";
import { HUB_CLASSIFICATIONS, HUB_TIER_PRICING, getHubPricingForIata } from "./hubs.js";

describe("hubs", () => {
  it("contains known hub classifications", () => {
    expect(HUB_CLASSIFICATIONS.JFK).toBeDefined();
    expect(HUB_CLASSIFICATIONS.LHR).toBeDefined();
    expect(HUB_CLASSIFICATIONS.JFK?.tier).toBeDefined();
  });

  it("returns tier pricing for a known hub", () => {
    const pricing = getHubPricingForIata("JFK");
    expect(pricing.tier).toBe(HUB_CLASSIFICATIONS.JFK?.tier);
    expect(pricing.openFee).toBe(HUB_TIER_PRICING[pricing.tier].openFee);
    expect(pricing.monthlyOpex).toBe(HUB_TIER_PRICING[pricing.tier].monthlyOpex);
  });

  it("falls back to regional pricing for unknown IATA", () => {
    const pricing = getHubPricingForIata("ZZZ");
    expect(pricing.tier).toBe("regional");
    expect(pricing.openFee).toBe(HUB_TIER_PRICING.regional.openFee);
    expect(pricing.monthlyOpex).toBe(HUB_TIER_PRICING.regional.monthlyOpex);
  });
});
