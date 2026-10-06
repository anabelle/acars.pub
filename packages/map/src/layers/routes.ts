import type * as maplibregl from "maplibre-gl";
import type { MapPalette } from "../theme.js";

// =============================================================================
// --- LOD: Adaptive segment count based on zoom level ---
// =============================================================================

/**
 * Returns the number of arc segments to use based on the current map zoom.
 * At low zooms, arcs are small on screen and need fewer segments.
 * At high zooms, arcs are large and need more segments for smooth curves.
 */
export function getSegmentCount(zoom: number): number {
  if (zoom < 2) return 8;
  if (zoom < 4) return 16;
  if (zoom < 6) return 24;
  if (zoom < 8) return 36;
  return 50;
}

// =============================================================================
// --- Arc Geometry Cache ---
// =============================================================================

/**
 * Cache key for a route arc. We use origin+dest IATA since the geometry
 * is purely a function of the two endpoints and the segment count.
 */
export function arcCacheKey(originIata: string, destIata: string, segments: number): string {
  return `${originIata}-${destIata}-${segments}`;
}

/** Route arc layers: rivals' routes (faint) under the player's active ones (dashed). */
export function addRouteLayers(map: maplibregl.Map, mapThemePalette: MapPalette): void {
  // Layer: Global Arcs
  map.addLayer({
    id: "global-arcs-layer",
    type: "line",
    source: "global-arcs",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": mapThemePalette.routes.global,
      "line-width": 0.5,
      "line-opacity": 0.2,
    },
  });

  // Layer: Active Flight Arcs (dashed)
  map.addLayer({
    id: "arcs-layer",
    type: "line",
    source: "arcs",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": mapThemePalette.routes.active,
      "line-width": 1,
      "line-opacity": 0.3,
      "line-dasharray": [2, 2],
    },
  });
}
