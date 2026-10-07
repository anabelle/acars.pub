import { DARK_MAP_STYLE_URL, getMapPalette } from "@acars/map";
import { PathLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { playerNetworkFocus, type RouteArc } from "./arcs";
import { shimMapTransform } from "./mapCompat";

// Same stable worker copy as the main globe (see WorldMap.tsx): maplibre v6
// otherwise resolves a worker file Vite never emits.
maplibregl.config.WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

/** What the prototype exposes for the perf probe and e2e (S45). */
export interface PlayGlobeStats {
  arcs: number;
  /** Frames deck.gl has drawn. */
  deckFrames: number;
}

declare global {
  interface Window {
    __acarsPlayStats?: PlayGlobeStats;
  }
}

function stats(): PlayGlobeStats {
  window.__acarsPlayStats ??= { arcs: 0, deckFrames: 0 };
  return window.__acarsPlayStats;
}

function arcLayer(arcs: readonly RouteArc[]) {
  return new PathLayer<RouteArc>({
    id: "play-route-arcs",
    data: arcs,
    getPath: (arc) => arc.path,
    getColor: (arc) => arc.color,
    getWidth: (arc) => arc.width,
    widthUnits: "pixels",
    jointRounded: true,
    capRounded: true,
  });
}

/**
 * The prototype's world (S45.1): a MapLibre globe with deck.gl drawing into
 * the same WebGL context (interleaved), so arcs depth-sort with the planet.
 * The map is created once; data changes only swap deck.gl layers.
 */
export function PlayGlobe({ arcs }: { arcs: readonly RouteArc[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [ready, setReady] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const palette = getMapPalette("dark");
    const map = new maplibregl.Map({
      container,
      style: DARK_MAP_STYLE_URL,
      center: [0, 30],
      zoom: 1.2,
      attributionControl: { compact: true },
    });
    shimMapTransform(map);
    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
      onAfterRender: () => {
        stats().deckFrames++;
      },
    });
    overlayRef.current = overlay;
    mapRef.current = map;
    map.on("style.load", () => {
      map.setProjection({ type: "globe" });
      map.setSky({
        "sky-color": palette.sky.space,
        "horizon-color": palette.sky.horizon,
        "fog-color": palette.sky.fog,
        "atmosphere-blend": 1,
      });
    });
    map.addControl(overlay as unknown as maplibregl.IControl);
    map.once("load", () => setReady(true));
    return () => {
      overlayRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !overlayRef.current) return;
    overlayRef.current.setProps({ layers: [arcLayer(arcs)] });
    stats().arcs = arcs.length;
    // Open on the player's own network, once.
    const focus = focusedRef.current ? null : playerNetworkFocus(arcs);
    if (focus && mapRef.current) {
      focusedRef.current = true;
      // Tilted, so the arcs read as 3D.
      mapRef.current.jumpTo({ ...focus, pitch: 40 });
    }
  }, [arcs, ready]);

  // MapLibre makes its container `position: relative`, so size it from a wrapper.
  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        data-testid="play-globe"
        data-ready={ready}
        data-arc-count={ready ? arcs.length : 0}
        className="h-full w-full"
      />
    </div>
  );
}
