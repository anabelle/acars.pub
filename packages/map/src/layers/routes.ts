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
 * Dash patterns for the flow animation: each step shifts the dash a little
 * along the line, so cycling through them makes the dashes travel origin →
 * destination (features are drawn in travel order). From the MapLibre
 * "animate a line" technique; values are in line-width units.
 */
export const ROUTE_FLOW_DASHES: readonly (readonly number[])[] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

/** Milliseconds per flow step (~10 steps a second keeps it smooth but cheap). */
export const ROUTE_FLOW_STEP_MS = 100;

/** The dash pattern for a given animation clock. Pure. */
export function routeFlowDash(nowMs: number): number[] {
  const step = Math.floor(nowMs / ROUTE_FLOW_STEP_MS) % ROUTE_FLOW_DASHES.length;
  return [...ROUTE_FLOW_DASHES[step]];
}

/** Layers holding rivals' routes and aircraft, hidden in "my network" view. */
export const WORLD_LAYER_IDS = [
  "global-arcs-layer",
  "global-flight-trail",
  "global-flights-layer",
  "global-flights-accent-layer",
  "global-flight-light-port",
  "global-flight-light-stbd",
  "global-flight-light-strobe",
] as const;

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

  // Flow: light dashes travelling along the player's routes (animated by the
  // globe via line-dasharray; static when motion is reduced).
  map.addLayer({
    id: "arcs-flow-layer",
    type: "line",
    source: "arcs",
    layout: { "line-cap": "butt", "line-join": "round" },
    paint: {
      "line-color": "#f8fafc",
      "line-width": routeWidthExpression(0.45),
      "line-opacity": 0.55,
      "line-dasharray": [...ROUTE_FLOW_DASHES[0]],
    },
  });
}
