import type { Route } from "@acars/core";
import { describe, expect, it } from "vitest";
import {
  ARC_PEAK_RATIO,
  ARC_SEGMENTS,
  arcPath,
  arcWidth,
  buildRouteArcs,
  greatCircleMeters,
  hexToRgb,
  playerNetworkFocus,
  type RouteArc,
  readableOnDark,
} from "./arcs";

const AIRPORTS: Record<string, { latitude: number; longitude: number }> = {
  MAD: { latitude: 40.47, longitude: -3.56 },
  BCN: { latitude: 41.3, longitude: 2.08 },
  LHR: { latitude: 51.47, longitude: -0.45 },
};
const lookup = (iata: string) => AIRPORTS[iata];

const route = (overrides: Partial<Route>): Route =>
  ({
    id: "r1",
    originIata: "MAD",
    destinationIata: "BCN",
    airlinePubkey: "me",
    distanceKm: 483,
    assignedAircraftIds: [],
    fareEconomy: 0,
    fareBusiness: 0,
    fareFirst: 0,
    status: "active",
    ...overrides,
  }) as Route;

describe("buildRouteArcs()", () => {
  it("turns active routes into lon/lat arcs in the owner's colour", () => {
    const arcs = buildRouteArcs(
      [{ routes: [route({})], colorHex: "#ff0000", isPlayer: true }],
      lookup,
    );
    expect(arcs).toEqual([
      {
        id: "r1",
        source: [-3.56, 40.47],
        target: [2.08, 41.3],
        path: expect.any(Array),
        color: [255, 0, 0, 230],
        width: 3,
        isPlayer: true,
      },
    ]);
  });

  it("skips suspended routes and unknown airports", () => {
    const arcs = buildRouteArcs(
      [
        {
          routes: [
            route({ id: "suspended", status: "suspended" }),
            route({ id: "unknown", destinationIata: "ZZZ" }),
          ],
          colorHex: "#ff0000",
          isPlayer: true,
        },
      ],
      lookup,
    );
    expect(arcs).toEqual([]);
  });

  it("draws rivals first, dimmer, so the player's network sits on top", () => {
    const arcs = buildRouteArcs(
      [
        { routes: [route({ id: "mine" })], colorHex: "#00ff00", isPlayer: true },
        {
          routes: [route({ id: "theirs", destinationIata: "LHR", airlinePubkey: "rival" })],
          colorHex: "#0000ff",
          isPlayer: false,
        },
      ],
      lookup,
    );
    expect(arcs.map((a) => a.id)).toEqual(["theirs", "mine"]);
    expect(arcs[0].color[3]).toBeLessThan(arcs[1].color[3]);
    expect(arcs[0].width).toBeLessThan(arcs[1].width);
  });
});

describe("arcWidth()", () => {
  it("grows with frequency and stays capped", () => {
    expect(arcWidth(7, true)).toBe(3);
    expect(arcWidth(14, true)).toBeCloseTo(4.5);
    expect(arcWidth(700, true)).toBe(8);
    expect(arcWidth(700, false)).toBe(4);
    expect(arcWidth(undefined, false)).toBe(1);
    expect(arcWidth(1, true)).toBe(3);
  });
});

describe("hexToRgb()", () => {
  it("reads long and short hex, and falls back on anything else", () => {
    expect(hexToRgb("#1e40af")).toEqual([30, 64, 175]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("red")).toEqual([96, 165, 250]);
    expect(hexToRgb(undefined)).toEqual([96, 165, 250]);
  });
});

describe("playerNetworkFocus()", () => {
  const arc = (source: [number, number], target: [number, number], isPlayer = true): RouteArc => ({
    id: "a",
    source,
    target,
    path: [],
    color: [0, 0, 0, 0],
    width: 1,
    isPlayer,
  });

  it("is null without player routes", () => {
    expect(playerNetworkFocus([])).toBeNull();
    expect(playerNetworkFocus([arc([0, 0], [10, 10], false)])).toBeNull();
  });

  it("centres on the network and zooms in close on a short hop", () => {
    const focus = playerNetworkFocus([arc([-3.56, 40.47], [2.08, 41.3])]);
    expect(focus?.center[0]).toBeCloseTo(-0.74);
    expect(focus?.center[1]).toBeCloseTo(40.885);
    // 5.6° of span: log2(360 / 5.64) − 1.5.
    expect(focus?.zoom).toBeCloseTo(4.5, 1);
  });

  it("pulls out for a long-haul network, never past the whole-globe view", () => {
    // Madrid–Athens, 27° wide: in between.
    const focus = playerNetworkFocus([arc([-3.56, 40.47], [23.94, 37.94])]);
    expect(focus?.zoom).toBeGreaterThan(1.2);
    expect(focus?.zoom).toBeLessThan(4.5);
    // Transatlantic and wider: the whole-globe view.
    expect(playerNetworkFocus([arc([-3.56, 40.47], [-73.78, 40.64])])?.zoom).toBe(1.2);
    expect(playerNetworkFocus([arc([-170, -60], [170, 70])])?.zoom).toBe(1.2);
  });
});

describe("readableOnDark()", () => {
  it("keeps bright colours and lifts dark ones toward white, keeping the hue", () => {
    expect(readableOnDark([255, 0, 0])).toEqual([255, 0, 0]);
    const indigo = readableOnDark([32, 25, 87]);
    expect(indigo).not.toEqual([32, 25, 87]);
    expect(indigo[2]).toBeGreaterThan(indigo[0]);
    expect(readableOnDark([0, 0, 0])[0]).toBeGreaterThan(100);
  });
});

describe("arcPath()", () => {
  it("follows the great circle from end to end, rising to a peak mid-route", () => {
    const path = arcPath([-3.56, 40.47], [2.08, 41.3]);
    expect(path).toHaveLength(ARC_SEGMENTS + 1);
    expect(path[0]).toEqual([-3.56, 40.47, 0]);
    expect(path[ARC_SEGMENTS][0]).toBeCloseTo(2.08);
    expect(path[ARC_SEGMENTS][2]).toBeCloseTo(0);
    const mid = path[ARC_SEGMENTS / 2][2];
    expect(mid).toBeCloseTo(greatCircleMeters([-3.56, 40.47], [2.08, 41.3]) * ARC_PEAK_RATIO);
    expect(Math.max(...path.map((p) => p[2]))).toBe(mid);
  });

  it("measures MAD–BCN at about 483 km", () => {
    expect(greatCircleMeters([-3.56, 40.47], [2.08, 41.3]) / 1000).toBeCloseTo(483, -1);
  });
});
