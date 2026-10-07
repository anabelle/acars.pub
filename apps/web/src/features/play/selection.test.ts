import { describe, expect, it } from "vitest";
import type { PlaneSchedule } from "./aircraft";
import type { NetworkAirport, RouteArc } from "./arcs";
import { bestPick, PLAY_LAYER_IDS, selectionFromPick } from "./selection";

const plane = { isPlayer: true } as PlaneSchedule;
const airport: NetworkAirport = { iata: "BCN", position: [2, 41], isPlayer: true };
const arc = { id: "r" } as RouteArc;

describe("selectionFromPick()", () => {
  it("maps each layer to its selection, planes by index", () => {
    expect(selectionFromPick({ layerId: PLAY_LAYER_IDS.arcs, index: 0, object: arc }, [])).toEqual({
      kind: "route",
      arc,
    });
    expect(
      selectionFromPick({ layerId: PLAY_LAYER_IDS.airports, index: 0, object: airport }, []),
    ).toEqual({ kind: "airport", airport });
    expect(
      selectionFromPick({ layerId: PLAY_LAYER_IDS.planes, index: 1, object: null }, [plane, plane]),
    ).toEqual({ kind: "plane", plane });
  });

  it("is null for empty space, other layers or stale indices", () => {
    expect(selectionFromPick({ layerId: undefined, index: -1, object: null }, [])).toBeNull();
    expect(selectionFromPick({ layerId: "other", index: 0, object: arc }, [])).toBeNull();
    expect(
      selectionFromPick({ layerId: PLAY_LAYER_IDS.planes, index: 3, object: null }, [plane]),
    ).toBeNull();
    expect(
      selectionFromPick({ layerId: PLAY_LAYER_IDS.arcs, index: 0, object: null }, []),
    ).toBeNull();
    expect(
      selectionFromPick({ layerId: PLAY_LAYER_IDS.airports, index: 0, object: null }, []),
    ).toBeNull();
  });
});

describe("bestPick()", () => {
  it("prefers an airport, then a plane, then a route", () => {
    const route = { layerId: PLAY_LAYER_IDS.arcs };
    const dot = { layerId: PLAY_LAYER_IDS.planes };
    const hub = { layerId: PLAY_LAYER_IDS.airports };
    expect(bestPick([route, dot, hub])).toBe(hub);
    expect(bestPick([route, dot])).toBe(dot);
    expect(bestPick([route])).toBe(route);
    expect(bestPick([{ layerId: undefined }, { layerId: "other" }])).toBeNull();
    expect(bestPick([])).toBeNull();
  });
});
