import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { PlaneBuffers } from "./aircraft";
import type { NetworkAirport, RouteArc } from "./arcs";
import { PLAY_LAYER_IDS } from "./selection";

/** Routes as 3D arcs (paths with altitude, see `arcPath`). Clickable. */
export function arcLayer(arcs: readonly RouteArc[]) {
  return new PathLayer<RouteArc>({
    id: PLAY_LAYER_IDS.arcs,
    data: arcs,
    getPath: (arc) => arc.path,
    getColor: (arc) => arc.color,
    getWidth: (arc) => arc.width,
    widthUnits: "pixels",
    jointRounded: true,
    capRounded: true,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 220],
  });
}

/** Airports on the world's networks: the player's bright, rivals' muted. Clickable. */
export function airportLayer(airports: readonly NetworkAirport[]) {
  return new ScatterplotLayer<NetworkAirport>({
    id: PLAY_LAYER_IDS.airports,
    data: airports,
    getPosition: (airport) => airport.position,
    getFillColor: (airport) => (airport.isPlayer ? [255, 255, 255, 235] : [148, 163, 184, 160]),
    getLineColor: [15, 23, 42, 255],
    stroked: true,
    lineWidthMinPixels: 1,
    getRadius: (airport) => (airport.isPlayer ? 5 : 3.5),
    radiusUnits: "pixels",
    pickable: true,
    autoHighlight: true,
    highlightColor: [52, 211, 153, 255],
  });
}

/**
 * Every plane as a dot in one instanced draw, read straight from typed
 * buffers (deck.gl binary attributes): no per-plane JS objects on the render
 * path. Dots, not plane icons: deck.gl 9.4's IconLayer drew nothing on the
 * MapLibre v6 globe (a D4 finding, see the S45 brief). Clickable by index.
 */
export function planeLayer(buffers: PlaneBuffers, version: number) {
  return new ScatterplotLayer({
    id: PLAY_LAYER_IDS.planes,
    data: {
      length: buffers.length,
      attributes: {
        getPosition: { value: buffers.positions, size: 3 },
        getFillColor: { value: buffers.colors, size: 4, normalized: true },
      },
    },
    radiusUnits: "pixels",
    getRadius: 2.5,
    radiusMinPixels: 1.5,
    pickable: true,
    // New positions every clock tick: a version bump re-uploads them.
    updateTriggers: { getPosition: version },
  });
}
