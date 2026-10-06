import type * as maplibregl from "maplibre-gl";
import { ROUTE_PROFIT_COLORS } from "./routes.js";

export const OPPORTUNITY_SOURCE = "opportunities";
export const OPPORTUNITY_LAYER_IDS = ["opportunity-heat", "opportunity-points"] as const;

/** Heat fades out as you zoom in, where the points alone read better. */
export const OPPORTUNITY_HEAT_MAX_ZOOM = 7;

/**
 * Opportunity layers under the airports: a heat glow weighted by positive
 * profit, and a point per destination coloured red → amber → green by score
 * and sized by its magnitude.
 */
export function addOpportunityLayers(map: maplibregl.Map, beforeId?: string): void {
  map.addSource(OPPORTUNITY_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer(
    {
      id: "opportunity-heat",
      type: "heatmap",
      source: OPPORTUNITY_SOURCE,
      maxzoom: OPPORTUNITY_HEAT_MAX_ZOOM,
      paint: {
        "heatmap-weight": ["get", "weight"],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 1, 0.8, 6, 1.6],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 1, 18, 4, 40, 7, 70],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(34, 197, 94, 0)",
          0.25,
          "rgba(34, 197, 94, 0.25)",
          0.6,
          "rgba(132, 204, 22, 0.5)",
          1,
          "rgba(250, 204, 21, 0.7)",
        ],
        "heatmap-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          OPPORTUNITY_HEAT_MAX_ZOOM - 1.5,
          0.85,
          OPPORTUNITY_HEAT_MAX_ZOOM,
          0,
        ],
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "opportunity-points",
      type: "circle",
      source: OPPORTUNITY_SOURCE,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          2,
          ["+", 3.5, ["*", 4, ["abs", ["get", "score"]]]],
          8,
          ["+", 5, ["*", 8, ["abs", ["get", "score"]]]],
        ],
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "score"],
          -1,
          ROUTE_PROFIT_COLORS.loss,
          0,
          ROUTE_PROFIT_COLORS.even,
          1,
          ROUTE_PROFIT_COLORS.profit,
        ],
        "circle-opacity": 0.85,
        "circle-stroke-color": "rgba(255, 255, 255, 0.7)",
        "circle-stroke-width": 1,
      },
    },
    beforeId,
  );
}
