/** Map themes: basemap style URLs and the palette each map layer draws with. */

export type MapTheme = "dark" | "light";
export const DEFAULT_MAP_THEME: MapTheme = "dark";
export const DARK_MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
export const EARTH_MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

export type NightTint = {
  r: number;
  g: number;
  b: number;
  maxAlpha: number;
};

export type MapPalette = {
  nightTint: NightTint;
  routes: {
    global: string;
    active: string;
  };
  airports: {
    playerHub: string;
    routeDestination: string;
    competitorHub: string;
    major: string;
    default: string;
    activeStroke: string;
    playerStroke: string;
    routeStroke: string;
    competitorStroke: string;
    majorStroke: string;
    defaultStroke: string;
  };
  flights: {
    fallbackAccent: string;
  };
};

/**
 * Centralized overlay palette for the lighter "earth" basemap treatment.
 *
 * Keep all shared route, airport, flight, and night-overlay colors here so
 * the map continues to read as a single coherent theme when the basemap or
 * overlay treatments are adjusted in the future.
 */
export const DARK_MAP_PALETTE: MapPalette = {
  nightTint: {
    r: 8,
    g: 10,
    b: 28,
    maxAlpha: 0.38,
  },
  routes: {
    global: "#475569",
    active: "#e94560",
  },
  airports: {
    playerHub: "#4ade80",
    routeDestination: "#e2e8f0",
    competitorHub: "#f97316",
    major: "#c6d6e8",
    default: "#8aa6c5",
    activeStroke: "#ffffff",
    playerStroke: "#e2e8f0",
    routeStroke: "#ffffff",
    competitorStroke: "#ffe0bf",
    majorStroke: "#dde7f3",
    defaultStroke: "#6f88a8",
  },
  flights: {
    fallbackAccent: "#94a3b8",
  },
};

export const EARTH_MAP_PALETTE: MapPalette = {
  nightTint: {
    r: 10,
    g: 28,
    b: 43,
    maxAlpha: 0.24,
  },
  routes: {
    global: "#4f7894",
    active: "#0ea5e9",
  },
  airports: {
    playerHub: "#4ade80",
    routeDestination: "#38bdf8",
    competitorHub: "#f97316",
    major: "#7dd3fc",
    default: "#5d88a1",
    activeStroke: "#f8fafc",
    playerStroke: "#e0f2fe",
    routeStroke: "#f8fafc",
    competitorStroke: "#ffedd5",
    majorStroke: "#e0f2fe",
    defaultStroke: "#dbeafe",
  },
  flights: {
    fallbackAccent: "#7dd3fc",
  },
};

export function getMapStyleUrl(theme: MapTheme): string {
  return theme === "light" ? EARTH_MAP_STYLE_URL : DARK_MAP_STYLE_URL;
}

export function getMapPalette(theme: MapTheme): MapPalette {
  return theme === "light" ? EARTH_MAP_PALETTE : DARK_MAP_PALETTE;
}
