import type { Airport } from "@acars/core";
import type { MapGeoJSONFeature, PointLike } from "maplibre-gl";

export const AIRPORT_INTERACTION_RADIUS_PX = 16;

export const FLIGHT_INTERACTION_LAYERS = [
  "flights-layer",
  "flights-accent-layer",
  "global-flights-layer",
  "global-flights-accent-layer",
  "flight-light-port",
  "flight-light-stbd",
  "flight-light-strobe",
  "global-flight-light-port",
  "global-flight-light-stbd",
  "global-flight-light-strobe",
] as const;

export interface ScreenPoint {
  x: number;
  y: number;
}

export type MapSelection =
  | { type: "airport"; airport: Airport }
  | { type: "aircraft"; aircraftId: string }
  | null;

type FeatureQuery = (
  geometry: PointLike | [PointLike, PointLike],
  options?: { layers?: string[] },
) => MapGeoJSONFeature[];

export function buildHitbox(
  point: ScreenPoint,
  radius: number,
): [[number, number], [number, number]] {
  return [
    [point.x - radius, point.y - radius],
    [point.x + radius, point.y + radius],
  ];
}

export function resolveMapSelection(
  point: ScreenPoint,
  queryRenderedFeatures: FeatureQuery,
): MapSelection {
  const airportFeature = queryRenderedFeatures(buildHitbox(point, AIRPORT_INTERACTION_RADIUS_PX), {
    layers: ["airports-layer"],
  })[0];

  if (airportFeature?.properties) {
    return {
      type: "airport",
      airport: airportFeature.properties as unknown as Airport,
    };
  }

  const flightFeature = queryRenderedFeatures([point.x, point.y], {
    layers: [...FLIGHT_INTERACTION_LAYERS],
  })[0];
  const aircraftId = flightFeature?.properties?.id;

  return aircraftId ? { type: "aircraft", aircraftId: String(aircraftId) } : null;
}
