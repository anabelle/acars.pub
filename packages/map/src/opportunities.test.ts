import { describe, expect, it } from "vitest";
import {
  addOpportunityLayers,
  OPPORTUNITY_HEAT_MAX_ZOOM,
  OPPORTUNITY_LAYER_IDS,
  OPPORTUNITY_SOURCE,
} from "./layers/opportunities.js";
import { buildOpportunityFeatures, opportunityScale } from "./opportunities.js";

describe("buildOpportunityFeatures()", () => {
  it("normalises profit to a −1…+1 score; only gains carry heat", () => {
    const features = buildOpportunityFeatures([
      { iata: "BCN", longitude: 2, latitude: 41, profitPerDay: 4000 },
      { iata: "LIS", longitude: -9, latitude: 38, profitPerDay: 1000 },
      { iata: "CDG", longitude: 2.5, latitude: 49, profitPerDay: -2000 },
    ]);
    // Scale = the 80th-percentile |profit| of [1000, 2000, 4000] → 2000.
    expect(features.map((f) => f.properties)).toEqual([
      { iata: "BCN", profitPerDay: 4000, score: 1, weight: 1 },
      { iata: "LIS", profitPerDay: 1000, score: 0.5, weight: 0.5 },
      { iata: "CDG", profitPerDay: -2000, score: -1, weight: 0 },
    ]);
    expect(features[0].geometry.coordinates).toEqual([2, 41]);
  });

  it("keeps one outlier from flattening the rest", () => {
    const opportunities = [252_000, 16_000, 15_000, 14_000, 12_000, 10_000].map((profit, i) => ({
      iata: `A${i}`,
      longitude: 0,
      latitude: 0,
      profitPerDay: profit,
    }));
    expect(opportunityScale(opportunities)).toBe(16_000);
    const scores = buildOpportunityFeatures(opportunities).map((f) => f.properties.score);
    expect(scores[0]).toBe(1);
    expect(Math.min(...scores)).toBeGreaterThan(0.5);
  });

  it("handles an empty set and all-zero profits", () => {
    expect(buildOpportunityFeatures([])).toEqual([]);
    const [flat] = buildOpportunityFeatures([
      { iata: "X", longitude: 0, latitude: 0, profitPerDay: 0 },
    ]);
    expect(flat.properties.score).toBe(0);
  });
});

describe("addOpportunityLayers()", () => {
  it("adds a source, a heat layer and a point layer below the given layer", () => {
    const layers: Array<{ spec: Record<string, unknown>; before?: string }> = [];
    const sources: string[] = [];
    addOpportunityLayers(
      {
        addSource: (id: string) => sources.push(id),
        addLayer: (spec: Record<string, unknown>, before?: string) => layers.push({ spec, before }),
      } as never,
      "active-hub-glow",
    );
    expect(sources).toEqual([OPPORTUNITY_SOURCE]);
    expect(layers.map((l) => l.spec.id)).toEqual([...OPPORTUNITY_LAYER_IDS]);
    expect(layers.every((l) => l.before === "active-hub-glow")).toBe(true);
    expect(layers[0].spec.type).toBe("heatmap");
    expect(layers[0].spec.maxzoom).toBe(OPPORTUNITY_HEAT_MAX_ZOOM);
    expect((layers[0].spec.paint as Record<string, unknown>)["heatmap-weight"]).toEqual([
      "get",
      "weight",
    ]);
    expect(layers[1].spec.type).toBe("circle");
  });
});
