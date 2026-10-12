import { describe, expect, it } from "vitest";
import { cityLights, nightFactor } from "./nightOverlay.js";

const airport = (
  city: string,
  population: number,
  latitude = 40,
  longitude = -3,
  country = "ES",
) => ({
  city,
  country,
  latitude,
  longitude,
  population,
});

describe("cityLights", () => {
  it("keeps one light per city, biggest first, capped", () => {
    const lights = cityLights(
      [
        airport("Madrid", 6_700_000),
        airport("Madrid", 6_700_000, 40.5, -3.6),
        airport("Tokyo", 37_000_000, 35.7, 139.7, "JP"),
        airport("Soria", 40_000),
        airport("Nowhere", 0),
      ],
      2,
    );
    expect(lights).toHaveLength(2);
    expect(lights[0].lng).toBeCloseTo(139.7);
    expect(lights[0].weight).toBe(1);
    expect(lights[1].weight).toBeGreaterThan(0.12);
    expect(lights[1].weight).toBeLessThan(1);
  });

  it("places cities on the Mercator canvas", () => {
    const [equator] = cityLights([airport("Quito", 2_000_000, 0, 0, "EC")]);
    expect(equator.x01).toBeCloseTo(0.5);
    expect(equator.y01).toBeCloseTo(0.5);
    const [north] = cityLights([airport("Oslo", 1_000_000, 60, 10, "NO")]);
    expect(north.y01).toBeLessThan(0.5);
    expect(cityLights([airport("Pole", 1_000_000, 89, 0, "AQ")])).toEqual([]);
  });
});

describe("nightFactor", () => {
  it("is 0 under the sun, 1 at the antipode, and rises through twilight", () => {
    expect(nightFactor(0, 0, 0, 0)).toBe(0);
    expect(nightFactor(0, 180, 0, 0)).toBe(1);
    expect(nightFactor(0, 91, 0, 0)).toBe(0);
    const dusk = nightFactor(0, 96, 0, 0);
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(1);
    expect(nightFactor(0, 101, 0, 0)).toBe(1);
  });
});
