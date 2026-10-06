import type { Airport } from "@acars/core";
import { describe, expect, it } from "vitest";
import {
  buildRouteFeatures,
  type MapRoute,
  profitScale,
  routeFeatureProperties,
} from "./routeFeatures.js";

const airport = (iata: string, longitude: number, latitude: number) =>
  ({ iata, longitude, latitude }) as Airport;
const index = new Map([
  ["MAD", airport("MAD", -3.6, 40.5)],
  ["BCN", airport("BCN", 2.1, 41.3)],
  ["LIS", airport("LIS", -9.1, 38.8)],
  ["HNL", airport("HNL", -157.9, 21.3)],
  ["NRT", airport("NRT", 140.4, 35.8)],
]);
const straight = (o: Airport, d: Airport): [number, number][] => [
  [o.longitude, o.latitude],
  [d.longitude, d.latitude],
];

const mine = (dest: string, profitPerHour: number | null, frequencyPerWeek?: number): MapRoute => ({
  originIata: "MAD",
  destinationIata: dest,
  ownerPubkey: "me",
  isPlayer: true,
  profitPerHour,
  frequencyPerWeek,
});

describe("profitScale", () => {
  it("is the largest absolute profit among the player's routes", () => {
    expect(
      profitScale([
        mine("BCN", 300),
        mine("LIS", -900),
        { ...mine("HNL", 5000), isPlayer: false },
        mine("NRT", null),
      ]),
    ).toBe(900);
    expect(profitScale([])).toBe(0);
  });
});

describe("routeFeatureProperties", () => {
  it("scores profit from −1 to +1 against the network", () => {
    expect(routeFeatureProperties(mine("BCN", 450), 900).profitScore).toBe(0.5);
    expect(routeFeatureProperties(mine("LIS", -900), 900).profitScore).toBe(-1);
    expect(routeFeatureProperties(mine("BCN", 2000), 900).profitScore).toBe(1);
    expect(routeFeatureProperties(mine("BCN", 0), 0).profitScore).toBe(0);
  });

  it("keeps unknown profit unknown and defaults the frequency", () => {
    expect(routeFeatureProperties(mine("BCN", null), 900)).toEqual({
      owner: "me",
      isPlayer: true,
      frequencyPerWeek: 7,
      profitPerHour: null,
      profitScore: null,
      color: null,
    });
    expect(routeFeatureProperties(mine("BCN", 1, 0), 1).frequencyPerWeek).toBe(1);
  });

  it("carries a rival's owner and livery colour", () => {
    const rival: MapRoute = {
      originIata: "LIS",
      destinationIata: "BCN",
      ownerPubkey: "rival",
      isPlayer: false,
      frequencyPerWeek: 14,
      color: "#ff8800",
    };
    expect(routeFeatureProperties(rival, 900)).toMatchObject({
      owner: "rival",
      isPlayer: false,
      frequencyPerWeek: 14,
      color: "#ff8800",
      profitScore: null,
    });
  });
});

describe("buildRouteFeatures", () => {
  it("draws each known route origin → destination with its properties", () => {
    const features = buildRouteFeatures(
      [mine("BCN", 300, 10), mine("LIS", -600), mine("XXX", 1)],
      index,
      straight,
    );
    expect(features).toHaveLength(2);
    expect(features[0].geometry).toEqual({
      type: "LineString",
      coordinates: [
        [-3.6, 40.5],
        [2.1, 41.3],
      ],
    });
    expect(features[0].properties).toMatchObject({ frequencyPerWeek: 10, profitScore: 0.5 });
    expect(features[1].properties).toMatchObject({ profitScore: -1 });
  });

  it("skips routes the caller culls and splits at the antimeridian", () => {
    const pacific: MapRoute = {
      originIata: "NRT",
      destinationIata: "HNL",
      ownerPubkey: "rival",
      isPlayer: false,
    };
    const culled = buildRouteFeatures(
      [mine("BCN", 1), pacific],
      index,
      straight,
      (o) => o.iata !== "MAD",
    );
    expect(culled).toHaveLength(1);
    expect(culled[0].properties).toMatchObject({ owner: "rival" });
    const curve = (o: Airport, d: Airport): [number, number][] => [
      [o.longitude, o.latitude],
      [179, 30],
      [-179, 28],
      [d.longitude, d.latitude],
    ];
    expect(buildRouteFeatures([pacific], index, curve)[0].geometry.type).toBe("MultiLineString");
  });
});
