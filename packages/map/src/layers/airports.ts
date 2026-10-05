import type * as maplibregl from "maplibre-gl";
import type { Airport, HubTier } from "@acars/core";
import { HUB_CLASSIFICATIONS } from "@acars/data";
import type { MapPalette } from "../theme.js";

export type AirportClass =
  | "active-hub"
  | "player-hub"
  | "route-dest"
  | "competitor-hub"
  | "major"
  | "default";

const MAJOR_HUB_TIERS = new Set<HubTier>(["global", "international"]);

export function isMajorAirport(airport: Airport): boolean {
  const tier = HUB_CLASSIFICATIONS[airport.iata]?.tier;
  if (tier && MAJOR_HUB_TIERS.has(tier)) return true;
  return airport.population >= 5_000_000;
}

export function buildPresenceBadge(
  segments: { color: string; count: number }[],
  size: number,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(size, size);

  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  if (total <= 0) return new ImageData(size, size);

  const center = size / 2;
  const radius = size / 2 - 2;
  let startAngle = -Math.PI / 2;

  ctx.lineWidth = Math.max(2, size * 0.18);

  for (const segment of segments) {
    if (segment.count <= 0) continue;
    const slice = (segment.count / total) * Math.PI * 2;
    ctx.strokeStyle = segment.color;
    ctx.beginPath();
    ctx.arc(center, center, radius, startAngle, startAngle + slice, false);
    ctx.stroke();
    startAngle += slice;
  }

  return ctx.getImageData(0, 0, size, size);
}

/** Airport layers: the active hub's glow, airport dots by class and ground-presence rings. */
export function addAirportLayers(map: maplibregl.Map, mapThemePalette: MapPalette): void {
  // Layer: Active Hub Glow
  map.addLayer({
    id: "active-hub-glow",
    type: "circle",
    source: "airports",
    filter: ["==", ["get", "airportClass"], "active-hub"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 6, 6, 14, 10, 22],
      "circle-color": ["coalesce", ["get", "playerHubColor"], mapThemePalette.airports.playerHub],
      "circle-opacity": 0.4,
      "circle-blur": 0.8,
    },
  });

  // Layer: Airports
  map.addLayer({
    id: "airports-layer",
    type: "circle",
    source: "airports",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        1,
        [
          "match",
          ["get", "airportClass"],
          "active-hub",
          3.5,
          "player-hub",
          3,
          "route-dest",
          2.1,
          "competitor-hub",
          2.9,
          "major",
          2,
          1.6,
        ],
        6,
        [
          "match",
          ["get", "airportClass"],
          "active-hub",
          7,
          "player-hub",
          6,
          "route-dest",
          3.5,
          "competitor-hub",
          5.8,
          "major",
          3.5,
          2.3,
        ],
        10,
        [
          "match",
          ["get", "airportClass"],
          "active-hub",
          12,
          "player-hub",
          9,
          "route-dest",
          4.6,
          "competitor-hub",
          8.6,
          "major",
          4,
          2.8,
        ],
      ],
      "circle-color": [
        "match",
        ["get", "airportClass"],
        "active-hub",
        ["coalesce", ["get", "playerHubColor"], mapThemePalette.airports.playerHub],
        "player-hub",
        ["coalesce", ["get", "playerHubColor"], mapThemePalette.airports.playerHub],
        "route-dest",
        mapThemePalette.airports.routeDestination,
        "competitor-hub",
        ["coalesce", ["get", "competitorHubColor"], mapThemePalette.airports.competitorHub],
        "major",
        mapThemePalette.airports.major,
        mapThemePalette.airports.default,
      ],
      "circle-opacity": [
        "match",
        ["get", "airportClass"],
        "active-hub",
        1,
        "player-hub",
        0.85,
        "route-dest",
        0.65,
        "competitor-hub",
        0.6,
        "major",
        0.55,
        0.35,
      ],
      "circle-stroke-width": [
        "match",
        ["get", "airportClass"],
        "active-hub",
        2,
        "player-hub",
        1.5,
        "route-dest",
        0.8,
        "competitor-hub",
        1,
        "major",
        0.8,
        0.4,
      ],
      "circle-stroke-color": [
        "match",
        ["get", "airportClass"],
        "active-hub",
        mapThemePalette.airports.activeStroke,
        "player-hub",
        mapThemePalette.airports.playerStroke,
        "route-dest",
        mapThemePalette.airports.routeStroke,
        "competitor-hub",
        mapThemePalette.airports.competitorStroke,
        "major",
        mapThemePalette.airports.majorStroke,
        mapThemePalette.airports.defaultStroke,
      ],
    },
  });

  // Layer: Ground Presence (multi-airline ring)
  map.addLayer({
    id: "ground-presence-layer",
    type: "symbol",
    source: "airports",
    filter: [">", ["get", "groundPresenceCount"], 0],
    minzoom: 3,
    layout: {
      "icon-image": ["get", "groundPresenceIcon"],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.45, 8, 0.8, 12, 1.15],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: {
      "icon-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.35, 6, 0.7, 10, 0.95],
    },
  });
}
