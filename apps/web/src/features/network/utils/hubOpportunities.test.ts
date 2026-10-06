import { type Airport, fp, TICKS_PER_HOUR } from "@acars/core";
import { describe, expect, it, vi } from "vitest";

const PROFIT: Record<string, number | null> = { BCN: 4800, LIS: 1200, CDG: -300, JFK: null };
const recommend = vi.fn((input: { destinationIata: string }) => {
  const profit = input.destinationIata in PROFIT ? PROFIT[input.destinationIata] : 0;
  return profit === null
    ? null
    : { model: { name: "A320neo" }, profitAfterLeasePerDay: fp(profit) };
});
vi.mock("@/features/network/utils/routeRecommendation", () => ({
  NEW_ROUTE_WEEKLY_FREQUENCY: 7,
  recommendAircraftForRoute: (input: never) => recommend(input),
}));

import {
  candidateDestinations,
  computeHubOpportunities,
  OPPORTUNITY_MIN_KM,
  OpportunityCache,
  opportunityCacheKey,
} from "./hubOpportunities";

const airport = (iata: string, latitude: number, longitude: number, population: number) =>
  ({ iata, latitude, longitude, population }) as Airport;
const AIRPORTS = [
  airport("MAD", 40.47, -3.56, 6_000_000),
  airport("BCN", 41.3, 2.08, 5_000_000),
  airport("LIS", 38.78, -9.14, 2_800_000),
  airport("CDG", 49.01, 2.55, 11_000_000),
  airport("JFK", 40.64, -73.78, 18_000_000),
  airport("TOJ", 40.49, -3.45, 100_000), // ~11 km away: too short
];
const base = {
  hubIata: "MAD",
  tier: 4,
  tick: 5 * TICKS_PER_HOUR + 10,
  brandScore: 0.5,
  playerPubkey: "me",
  routes: [],
  registry: new Map(),
};

describe("candidateDestinations()", () => {
  it("keeps airports in range and long enough, most populous first", () => {
    const hub = AIRPORTS[0];
    const list = candidateDestinations(hub, AIRPORTS, 4, new Set(), 10);
    expect(list.map((c) => c.airport.iata)).toEqual(["JFK", "CDG", "BCN", "LIS"]);
    expect(list.every((c) => c.distanceKm >= OPPORTUNITY_MIN_KM)).toBe(true);
  });

  it("drops served destinations, out-of-range ones and the limit's overflow", () => {
    const hub = AIRPORTS[0];
    // Tier 1 range excludes transatlantic flights.
    const tier1 = candidateDestinations(hub, AIRPORTS, 1, new Set(["BCN"]), 10);
    expect(tier1.map((c) => c.airport.iata)).not.toContain("JFK");
    expect(tier1.map((c) => c.airport.iata)).not.toContain("BCN");
    expect(candidateDestinations(hub, AIRPORTS, 4, new Set(), 2)).toHaveLength(2);
  });
});

describe("computeHubOpportunities()", () => {
  it("projects each destination and ranks by profit per day", () => {
    const result = computeHubOpportunities(base, AIRPORTS);
    expect(result.map((o) => [o.iata, o.profitPerDay])).toEqual([
      ["BCN", 4800],
      ["LIS", 1200],
      ["CDG", -300],
    ]);
    expect(result[0]).toMatchObject({ latitude: 41.3, longitude: 2.08, modelName: "A320neo" });
  });

  it("skips destinations the hub already serves and includes the candidate in the network", () => {
    recommend.mockClear();
    const routes = [{ originIata: "MAD", destinationIata: "BCN", frequencyPerWeek: 7 }];
    const result = computeHubOpportunities({ ...base, routes }, AIRPORTS);
    expect(result.map((o) => o.iata)).not.toContain("BCN");
    const call = recommend.mock.calls[0][0] as unknown as { networkRoutes: unknown[] };
    expect(call.networkRoutes).toHaveLength(2);
  });

  it("returns nothing for an unknown hub", () => {
    expect(computeHubOpportunities({ ...base, hubIata: "XXX" }, AIRPORTS)).toEqual([]);
  });
});

describe("opportunityCacheKey()", () => {
  it("is shared within a game hour and changes with the hub or network", () => {
    const key = opportunityCacheKey(base);
    expect(opportunityCacheKey({ ...base, tick: 5 * TICKS_PER_HOUR })).toBe(key);
    expect(opportunityCacheKey({ ...base, tick: 6 * TICKS_PER_HOUR })).not.toBe(key);
    expect(opportunityCacheKey({ ...base, hubIata: "BCN" })).not.toBe(key);
    const routes = [{ originIata: "MAD", destinationIata: "LIS", frequencyPerWeek: 14 }];
    expect(opportunityCacheKey({ ...base, routes })).not.toBe(key);
  });
});

describe("OpportunityCache", () => {
  it("evicts the least recently used entry", () => {
    const cache = new OpportunityCache(2);
    cache.set("a", []);
    cache.set("b", []);
    cache.get("a");
    cache.set("c", []);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toEqual([]);
    expect(cache.size).toBe(2);
    cache.set("a", []);
    expect(cache.size).toBe(2);
  });
});
