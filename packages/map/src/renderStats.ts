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
  /** Whether low-power rendering is on (S54.3). */
  lowPower: boolean;
}

type StatsGlobal = { __acarsMapStats?: MapRenderStats };

/** The page-wide counters (on `globalThis`, i.e. `window`), created on first use. */
export function mapRenderStats(): MapRenderStats {
  const g = globalThis as StatsGlobal;
  g.__acarsMapStats ??= { renders: 0, requests: 0, lowPower: false };
  return g.__acarsMapStats;
}

/** Counts every frame `map` draws. */
export function trackMapRenders(map: Pick<maplibregl.Map, "on">): void {
  const stats = mapRenderStats();
  map.on("render", () => {
    stats.renders++;
  });
}

/**
 * A test handle for the e2e specs (S56.2): screen pixels of a surface point,
 * and an instant camera move, so a spec can click a route arc at a known
 * place. Read-only towards the game; one small object on `window`.
 */
export interface MapTestHandle {
  project: (lng: number, lat: number) => [number, number];
  jumpTo: (center: [number, number], zoom: number) => void;
}

type HandleGlobal = { __acarsMapTest?: MapTestHandle };

export function exposeMapTestHandle(
  map: Pick<maplibregl.Map, "project" | "jumpTo" | "getContainer">,
): () => void {
  const g = globalThis as HandleGlobal;
  const handle: MapTestHandle = {
    project: (lng, lat) => {
      const point = map.project([lng, lat]);
      const box = map.getContainer().getBoundingClientRect();
      return [box.left + point.x, box.top + point.y];
    },
    jumpTo: (center, zoom) => map.jumpTo({ center, zoom, pitch: 0, bearing: 0 }),
  };
  g.__acarsMapTest = handle;
  return () => {
    if (g.__acarsMapTest === handle) delete g.__acarsMapTest;
  };
}
