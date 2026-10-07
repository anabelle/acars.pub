import { ScatterplotLayer } from "@deck.gl/layers";
import type { PlaneBuffers } from "./aircraft";

/**
 * Every plane as a dot in one instanced draw, read straight from typed
 * buffers (deck.gl binary attributes): no per-plane JS objects on the render
 * path. Dots, not plane icons: deck.gl 9.4's IconLayer drew nothing on the
 * MapLibre v6 globe (a D4 finding, see the S45 brief).
 */
export function planeLayer(buffers: PlaneBuffers, version: number) {
  return new ScatterplotLayer({
    id: "play-planes",
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
    // New positions every clock tick: a version bump re-uploads them.
    updateTriggers: { getPosition: version },
  });
}
