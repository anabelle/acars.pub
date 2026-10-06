import type * as maplibregl from "maplibre-gl";
import type { MapPalette } from "../theme.js";

/**
 * Zoom where the atmosphere has fully faded: at low zoom the whole planet is
 * on screen and the halo sells it as a globe; close in it would only tint the
 * horizon of a flat-looking map.
 */
export const ATMOSPHERE_FADE_END_ZOOM = 7;

/** Sky for the globe: dark space, a glowing horizon and haze that fades as you zoom in. */
export function globeSky(palette: MapPalette): maplibregl.SkySpecification {
  return {
    "sky-color": palette.sky.space,
    "horizon-color": palette.sky.horizon,
    "fog-color": palette.sky.fog,
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.5,
    "fog-ground-blend": 0.4,
    "atmosphere-blend": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      1,
      5,
      1,
      ATMOSPHERE_FADE_END_ZOOM,
      0,
    ],
  };
}

/**
 * Renders the world as a globe (MapLibre's "globe" projection switches to
 * Mercator on its own when zoomed in close) with an atmosphere. Projection and
 * sky belong to the style, so this runs on every style load.
 */
export function applyGlobeView(map: maplibregl.Map, palette: MapPalette): void {
  map.setProjection({ type: "globe" });
  map.setSky(globeSky(palette));
}

/** On-screen diameter of the globe at zoom 0, in CSS pixels (measured). */
export const GLOBE_DIAMETER_AT_ZOOM_0 = 450;

/**
 * Zoom at which the whole planet fits the viewport with a margin, for the
 * first "from space" view. Capped so large screens don't start too far out.
 */
export function globeFitZoom(width: number, height: number, fill = 0.85): number {
  const shortest = Math.min(width, height);
  if (!(shortest > 0)) return 1.5;
  const zoom = Math.log2((fill * shortest) / GLOBE_DIAMETER_AT_ZOOM_0);
  return Math.max(-1, Math.min(1.5, Math.round(zoom * 100) / 100));
}
