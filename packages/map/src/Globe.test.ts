import { describe, expect, it } from "vitest";
import {
  arcCacheKey,
  DARK_MAP_PALETTE,
  DARK_MAP_STYLE_URL,
  DEFAULT_MAP_THEME,
  EARTH_MAP_PALETTE,
  EARTH_MAP_STYLE_URL,
  getMapPalette,
  getMapStyleUrl,
  getSegmentCount,
  isMajorAirport,
} from "./Globe.js";
import { HUB_CLASSIFICATIONS } from "@acars/data";
import type { Airport } from "@acars/core";

describe("earth map palette", () => {
  it("keeps dark mode as the default theme", () => {
    expect(DEFAULT_MAP_THEME).toBe("dark");
    expect(getMapStyleUrl("dark")).toBe(DARK_MAP_STYLE_URL);
    expect(getMapPalette("dark")).toBe(DARK_MAP_PALETTE);
  });

  it("uses the lighter voyager basemap for improved daylight readability", () => {
    expect(EARTH_MAP_STYLE_URL).toBe(
      "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
    );
    expect(getMapStyleUrl("light")).toBe(EARTH_MAP_STYLE_URL);
  });

  it("keeps overlay colors in the new green-blue earth palette", () => {
    expect(EARTH_MAP_PALETTE.nightTint.maxAlpha).toBeLessThan(0.3);
    expect(EARTH_MAP_PALETTE.airports.playerHub).toBe("#4ade80");
    expect(EARTH_MAP_PALETTE.airports.routeDestination).toBe("#38bdf8");
    expect(EARTH_MAP_PALETTE.routes.active).toBe("#0ea5e9");
  });

  it("retains the original dark overlay accents for night mode", () => {
    expect(DARK_MAP_PALETTE.nightTint.maxAlpha).toBeGreaterThan(0.3);
    expect(DARK_MAP_PALETTE.routes.active).toBe("#e94560");
    expect(DARK_MAP_PALETTE.airports.routeDestination).toBe("#e2e8f0");
  });
});

describe("getSegmentCount", () => {
  it("returns increasing segment counts across zoom bands", () => {
    expect(getSegmentCount(0)).toBe(8);
    expect(getSegmentCount(1.99)).toBe(8);
    expect(getSegmentCount(2)).toBe(16);
    expect(getSegmentCount(3.99)).toBe(16);
    expect(getSegmentCount(4)).toBe(24);
    expect(getSegmentCount(5.99)).toBe(24);
    expect(getSegmentCount(6)).toBe(36);
    expect(getSegmentCount(7.99)).toBe(36);
    expect(getSegmentCount(8)).toBe(50);
    expect(getSegmentCount(20)).toBe(50);
  });
});

describe("arcCacheKey", () => {
  it("combines origin, destination, and segment count into a stable key", () => {
    expect(arcCacheKey("JFK", "LAX", 24)).toBe("JFK-LAX-24");
    expect(arcCacheKey("JFK", "LAX", 24)).not.toBe(arcCacheKey("LAX", "JFK", 24));
    expect(arcCacheKey("JFK", "LAX", 24)).not.toBe(arcCacheKey("JFK", "LAX", 36));
  });
});

describe("isMajorAirport", () => {
  const baseAirport = (overrides: Partial<Airport> = {}): Airport =>
    ({
      id: "1",
      iata: overrides.iata ?? "XXX",
      name: "Test",
      city: "Test",
      country: "TS",
      latitude: 0,
      longitude: 0,
      altitude: 0,
      timezone: "UTC",
      population: overrides.population ?? 0,
      gdpPerCapita: 0,
      runwayLengthFt: 0,
      tags: [],
      ...overrides,
    }) as Airport;

  it("classifies airports by a large population threshold (>= 5M)", () => {
    expect(isMajorAirport(baseAirport({ population: 5_000_000 }))).toBe(true);
    expect(isMajorAirport(baseAirport({ population: 4_999_999 }))).toBe(false);
  });

  it("classifies airports by a known global/international hub tier", () => {
    // Find a real IATA with a global or international tier from the catalog.
    const globalIata = Object.entries(HUB_CLASSIFICATIONS).find(
      ([, hub]) => hub.tier === "global" || hub.tier === "international",
    )?.[0];
    expect(globalIata).toBeDefined();
    expect(isMajorAirport(baseAirport({ iata: globalIata!, population: 0 }))).toBe(true);
  });

  it("returns false for unknown IATA with low population", () => {
    expect(isMajorAirport(baseAirport({ iata: "ZZZZZ", population: 100 }))).toBe(false);
  });
});
