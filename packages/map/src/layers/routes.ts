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

/** Profit colour ramp for the player's routes: losing, breaking even, earning. */
export const ROUTE_PROFIT_COLORS = {
  loss: "#ef4444",
  even: "#f59e0b",
  profit: "#22c55e",
} as const;

/**
 * Player route colour from `profitScore` (−1…+1, see routeFeatures): red for
 * the worst loss through amber at break-even to green for the best earner.
 * Routes that haven't flown yet (no score) use the theme's route colour.
 */
export function routeColorExpression(palette: MapPalette): maplibregl.ExpressionSpecification {
  return [
    "case",
    ["==", ["typeof", ["get", "profitScore"]], "number"],
    [
      "interpolate",
      ["linear"],
      ["get", "profitScore"],
      -1,
      ROUTE_PROFIT_COLORS.loss,
      0,
      ROUTE_PROFIT_COLORS.even,
      1,
      ROUTE_PROFIT_COLORS.profit,
    ],
    palette.routes.active,
  ];
}

/** Rival route colour: their livery, else the theme's world-route colour. */
export function rivalRouteColorExpression(palette: MapPalette): maplibregl.ExpressionSpecification {
  return ["coalesce", ["get", "color"], palette.routes.global];
}

/**
 * Line width from weekly round trips (1×/wk thin … 42×/wk thick), scaled up as
 * you zoom in. `scale` makes rivals thinner than the player's routes.
 */
export function routeWidthExpression(scale: number): maplibregl.ExpressionSpecification {
  const byFrequency = (factor: number): maplibregl.ExpressionSpecification => [
    "*",
    factor * scale,
    ["interpolate", ["linear"], ["get", "frequencyPerWeek"], 1, 0.8, 7, 1.6, 21, 2.8, 42, 4],
  ];
  return ["interpolate", ["linear"], ["zoom"], 1, byFrequency(0.6), 6, byFrequency(1.2)];
}

/**
 * Route layers: rivals' routes (thin, in their livery) under the player's,
 * coloured by profit and sized by frequency.
 */
export function addRouteLayers(map: maplibregl.Map, mapThemePalette: MapPalette): void {
  map.addLayer({
    id: "global-arcs-layer",
    type: "line",
    source: "global-arcs",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": rivalRouteColorExpression(mapThemePalette),
      "line-width": routeWidthExpression(0.5),
      "line-opacity": 0.3,
    },
  });

  map.addLayer({
    id: "arcs-layer",
    type: "line",
    source: "arcs",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": routeColorExpression(mapThemePalette),
      "line-width": routeWidthExpression(1),
      "line-opacity": 0.85,
    },
  });
}
