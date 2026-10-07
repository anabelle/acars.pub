import type * as maplibregl from "maplibre-gl";

/**
 * Map render counters (S54). `renders` counts frames MapLibre actually drew;
 * `requests` counts the moments the globe pushed a change that forces a
 * redraw (a flight-position upload, a route-flow step). The perf probe
 * (apps/web/e2e/perf-probe.spec.ts) reads them from `window.__acarsMapStats`.
 * Two integer increments per frame: cheap enough to keep in production.
 */
export interface MapRenderStats {
  renders: number;
  requests: number;
}

type StatsGlobal = { __acarsMapStats?: MapRenderStats };

/** The page-wide counters (on `globalThis`, i.e. `window`), created on first use. */
export function mapRenderStats(): MapRenderStats {
  const g = globalThis as StatsGlobal;
  g.__acarsMapStats ??= { renders: 0, requests: 0 };
  return g.__acarsMapStats;
}

/** Counts every frame `map` draws. */
export function trackMapRenders(map: Pick<maplibregl.Map, "on">): void {
  const stats = mapRenderStats();
  map.on("render", () => {
    stats.renders++;
  });
}
