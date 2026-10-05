import type { AircraftModel } from "@acars/core";
import { fpToNumber, getMaxFares, getMaxRouteDistanceKm, getSuggestedFares } from "@acars/core";
import { describe, expect, it } from "vitest";
import { FARE_PRESETS, fareProjectionBase, matchingPreset, presetFares } from "./fareProjection";

const model = { id: "atr72-600" } as AircraftModel;
const base = {
  fleet: [
    {
      id: "a1",
      modelId: "atr72-600",
      configuration: { economy: 68, business: 2, first: 0, cargoKg: 0 },
    },
    {
      id: "a2",
      modelId: "atr72-600",
      configuration: { economy: 70, business: 0, first: 0, cargoKg: 0 },
    },
  ],
  getModel: (id: string) => (id === "atr72-600" ? model : undefined),
  tick: 1200,
  tier: 2,
  brandScore: 0.6,
  playerPubkey: "me",
  competitorOffers: [],
  networkRoutes: [],
};
const route = {
  originIata: "MAD",
  destinationIata: "BCN",
  distanceKm: 483,
  assignedAircraftIds: ["a1", "a2", "gone"],
  frequencyPerWeek: 10,
};

describe("fare presets", () => {
  it("scales the suggested fares and rounds to whole dollars", () => {
    const suggested = getSuggestedFares(483);
    expect(presetFares(483, "suggested")).toEqual({
      economy: Math.round(fpToNumber(suggested.economy)),
      business: Math.round(fpToNumber(suggested.business)),
      first: Math.round(fpToNumber(suggested.first)),
    });
    const premium = presetFares(483, "premium");
    expect(premium.economy).toBe(Math.round(fpToNumber(suggested.economy) * FARE_PRESETS.premium));
    expect(presetFares(483, "aggressive").economy).toBeLessThan(premium.economy);
  });

  it("never goes above the fare cap", () => {
    const max = getMaxFares(483);
    for (const preset of ["aggressive", "suggested", "premium"] as const) {
      const fares = presetFares(483, preset);
      expect(fares.economy).toBeLessThanOrEqual(fpToNumber(max.economy));
      expect(fares.first).toBeLessThanOrEqual(fpToNumber(max.first));
    }
  });

  it("recognises the preset the fares match", () => {
    expect(matchingPreset(483, presetFares(483, "premium"))).toBe("premium");
    expect(matchingPreset(483, { economy: 1, business: 2, first: 3 })).toBeNull();
  });
});

describe("fareProjectionBase", () => {
  it("projects with the route's real aircraft, seats and frequency", () => {
    expect(fareProjectionBase({ ...base, route })).toEqual({
      originIata: "MAD",
      destinationIata: "BCN",
      distanceKm: 483,
      model,
      aircraftCount: 2,
      frequencyPerWeek: 10,
      seatConfig: { economy: 68, business: 2, first: 0 },
      tick: 1200,
      competitorOffers: [],
      playerPubkey: "me",
      playerBrandScore: 0.6,
      distanceLimitKm: getMaxRouteDistanceKm(2),
      networkRoutes: [],
    });
  });

  it("returns null when nothing flies the route", () => {
    expect(
      fareProjectionBase({ ...base, route: { ...route, assignedAircraftIds: [] } }),
    ).toBeNull();
    expect(fareProjectionBase({ ...base, getModel: () => undefined, route })).toBeNull();
  });
});
