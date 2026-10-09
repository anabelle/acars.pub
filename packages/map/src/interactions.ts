import type { Airport } from "@acars/core";
import type { MapGeoJSONFeature, PointLike } from "maplibre-gl";

export const AIRPORT_INTERACTION_RADIUS_PX = 24;

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
];

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Route arcs a click can pick, the player's first (drawn on top). */
export const ROUTE_INTERACTION_LAYERS = ["arcs-layer", "global-arcs-layer"];
/** Arcs are thin: a little slack makes them tappable without stealing other clicks. */
export const ROUTE_INTERACTION_RADIUS_PX = 6;

export interface RouteSelection {
  routeId: string;
  originIata: string;
  destinationIata: string;
  ownerPubkey: string;
  isPlayer: boolean;
}

export type MapSelection =
  | { type: "airport"; airport: Airport }
  | { type: "aircraft"; aircraftId: string }
  | ({ type: "route" } & RouteSelection)
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

function isAirportProperties(value: unknown): value is Airport {
  if (!value || typeof value !== "object") return false;

  const airport = value as Record<string, unknown>;

  return (
    typeof airport.id === "string" &&
    typeof airport.iata === "string" &&
    typeof airport.icao === "string" &&
    typeof airport.name === "string" &&
    typeof airport.city === "string" &&
    typeof airport.country === "string" &&
    typeof airport.latitude === "number" &&
    typeof airport.longitude === "number" &&
    typeof airport.population === "number" &&
    typeof airport.gdpPerCapita === "number" &&
    typeof airport.altitude === "number" &&
    typeof airport.timezone === "string" &&
    airport.tags !== undefined
  );
}

export function resolveMapSelection(
  point: ScreenPoint,
  queryRenderedFeatures: FeatureQuery,
): MapSelection {
  // Several airports can share the hitbox (BCN and Sabadell): the busiest
  // one is almost always the one meant (S56.3).
  let airport: Airport | null = null;
  for (const feature of queryRenderedFeatures(buildHitbox(point, AIRPORT_INTERACTION_RADIUS_PX), {
    layers: ["airports-layer"],
  })) {
    const properties = feature.properties;
    if (!isAirportProperties(properties)) continue;
    if (!airport || properties.population > airport.population) airport = properties;
  }
  if (airport) return { type: "airport", airport };

  const flightFeature = queryRenderedFeatures([point.x, point.y], {
    layers: FLIGHT_INTERACTION_LAYERS,
  })[0];
  const aircraftId = flightFeature?.properties?.id;
  if (aircraftId) return { type: "aircraft", aircraftId: String(aircraftId) };

  // Lowest priority: a route arc (the most specific thing under the cursor wins).
  const routeFeatures = queryRenderedFeatures(buildHitbox(point, ROUTE_INTERACTION_RADIUS_PX), {
    layers: ROUTE_INTERACTION_LAYERS,
  });
  const routeFeature =
    routeFeatures.find((feature) => feature.layer?.id === "arcs-layer") ?? routeFeatures[0];
  const route = routeFeature?.properties;
  if (route && typeof route.originIata === "string" && typeof route.destinationIata === "string") {
    return {
      type: "route",
      routeId: typeof route.routeId === "string" ? route.routeId : "",
      originIata: route.originIata,
      destinationIata: route.destinationIata,
      ownerPubkey: typeof route.owner === "string" ? route.owner : "",
      isPlayer: route.isPlayer === true || route.isPlayer === "true",
    };
  }
  return null;
}
