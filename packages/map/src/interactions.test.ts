import { describe, expect, it, vi } from "vitest";
import {
  AIRPORT_INTERACTION_RADIUS_PX,
  buildHitbox,
  FLIGHT_INTERACTION_LAYERS,
  ROUTE_INTERACTION_LAYERS,
  ROUTE_INTERACTION_RADIUS_PX,
  resolveMapSelection,
} from "./interactions.js";

describe("map interactions", () => {
  it("builds a square airport hitbox around the pointer", () => {
    expect(buildHitbox({ x: 50, y: 75 }, AIRPORT_INTERACTION_RADIUS_PX)).toEqual([
      [26, 51],
      [74, 99],
    ]);
  });

  it("prioritizes airports over overlapping aircraft and uses the expanded airport hitbox", () => {
    const queryRenderedFeatures = vi.fn().mockReturnValueOnce([
      {
        properties: {
          iata: "JFK",
          icao: "KJFK",
          name: "John F Kennedy",
          city: "New York",
          country: "US",
          latitude: 40.6413,
          longitude: -73.7781,
          population: 1,
          gdpPerCapita: 1,
          altitude: 13,
          timezone: "America/New_York",
          tags: [],
          id: "1",
        },
      },
    ]);

    expect(resolveMapSelection({ x: 100, y: 200 }, queryRenderedFeatures)).toEqual({
      type: "airport",
      airport: expect.objectContaining({ iata: "JFK" }),
    });
    expect(queryRenderedFeatures).toHaveBeenCalledWith(
      [
        [100 - AIRPORT_INTERACTION_RADIUS_PX, 200 - AIRPORT_INTERACTION_RADIUS_PX],
        [100 + AIRPORT_INTERACTION_RADIUS_PX, 200 + AIRPORT_INTERACTION_RADIUS_PX],
      ],
      { layers: ["airports-layer"] },
    );
    expect(queryRenderedFeatures).toHaveBeenCalledTimes(1);
  });

  it("falls back to aircraft selection when no airport is in range", () => {
    const queryRenderedFeatures = vi
      .fn()
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ properties: { id: "ac-456" } }]);

    expect(resolveMapSelection({ x: 10, y: 20 }, queryRenderedFeatures)).toEqual({
      type: "aircraft",
      aircraftId: "ac-456",
    });
    expect(queryRenderedFeatures).toHaveBeenNthCalledWith(2, [10, 20], {
      layers: FLIGHT_INTERACTION_LAYERS,
    });
  });

  it("returns null when no interactive feature is found", () => {
    const queryRenderedFeatures = vi.fn().mockReturnValue([]);

    expect(resolveMapSelection({ x: 0, y: 0 }, queryRenderedFeatures)).toBeNull();
    // Airports, aircraft, then route arcs.
    expect(queryRenderedFeatures).toHaveBeenCalledTimes(3);
  });

  it("falls back to a route arc, preferring the player's over a rival's", () => {
    const arc = (layer: string, owner: string, isPlayer: boolean | string) => ({
      layer: { id: layer },
      properties: {
        routeId: `r-${owner}`,
        originIata: "MAD",
        destinationIata: "BCN",
        owner,
        isPlayer,
      },
    });
    const queryRenderedFeatures = vi
      .fn()
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        arc("global-arcs-layer", "rival", false),
        arc("arcs-layer", "me", "true"),
      ]);

    expect(resolveMapSelection({ x: 30, y: 40 }, queryRenderedFeatures)).toEqual({
      type: "route",
      routeId: "r-me",
      originIata: "MAD",
      destinationIata: "BCN",
      ownerPubkey: "me",
      isPlayer: true,
    });
    expect(queryRenderedFeatures).toHaveBeenNthCalledWith(
      3,
      buildHitbox({ x: 30, y: 40 }, ROUTE_INTERACTION_RADIUS_PX),
      { layers: ROUTE_INTERACTION_LAYERS },
    );
  });

  it("selects a rival's arc and ignores arc features without endpoints", () => {
    const rival = vi
      .fn()
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          layer: { id: "global-arcs-layer" },
          properties: { originIata: "LIS", destinationIata: "BCN", owner: "rival" },
        },
      ]);
    expect(resolveMapSelection({ x: 1, y: 1 }, rival)).toEqual({
      type: "route",
      routeId: "",
      originIata: "LIS",
      destinationIata: "BCN",
      ownerPubkey: "rival",
      isPlayer: false,
    });

    const junk = vi
      .fn()
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ layer: { id: "arcs-layer" }, properties: { owner: "me" } }]);
    expect(resolveMapSelection({ x: 1, y: 1 }, junk)).toBeNull();
  });

  it("ignores malformed airport properties and falls back to aircraft selection", () => {
    const queryRenderedFeatures = vi
      .fn()
      .mockReturnValueOnce([{ properties: { iata: "JFK" } }])
      .mockReturnValueOnce([{ properties: { id: "ac-789" } }]);

    expect(resolveMapSelection({ x: 4, y: 8 }, queryRenderedFeatures)).toEqual({
      type: "aircraft",
      aircraftId: "ac-789",
    });
  });

  it("selects airports when tags are serialized as a string (MapLibre queryRenderedFeatures behavior)", () => {
    const queryRenderedFeatures = vi.fn().mockReturnValueOnce([
      {
        properties: {
          iata: "LAX",
          icao: "KLAX",
          name: "Los Angeles International",
          city: "Los Angeles",
          country: "US",
          latitude: 33.9425,
          longitude: -118.408,
          population: 3_979_576,
          gdpPerCapita: 65_000,
          altitude: 126,
          timezone: "America/Los_Angeles",
          tags: '["business"]',
          id: "3484",
        },
      },
    ]);

    expect(resolveMapSelection({ x: 50, y: 50 }, queryRenderedFeatures)).toEqual({
      type: "airport",
      airport: expect.objectContaining({ iata: "LAX" }),
    });
  });
});
