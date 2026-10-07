import { DARK_MAP_STYLE_URL, getMapPalette } from "@acars/map";
import { PathLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import {
  allocatePlaneBuffers,
  type PlaneBuffers,
  type PlaneSchedule,
  writePlanePositions,
} from "./aircraft";
import { playerNetworkFocus, type RouteArc } from "./arcs";
import { shimMapTransform } from "./mapCompat";
import { planeLayer } from "./planeLayer";
import { nowTick } from "./usePlayPlanes";

// Same stable worker copy as the main globe (see WorldMap.tsx): maplibre v6
// otherwise resolves a worker file Vite never emits.
maplibregl.config.WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

/** What the prototype exposes for the perf probe and e2e (S45). */
export interface PlayGlobeStats {
  arcs: number;
  planes: number;
  /** Frames deck.gl has drawn. */
  deckFrames: number;
  /** Browser animation frames (rAF): the real frame rate when the camera moves. */
  rafFrames: number;
  /** Moving average of one plane-position update (JS side), ms. */
  updateMs: number;
}

declare global {
  interface Window {
    __acarsPlayStats?: PlayGlobeStats;
  }
}

function stats(): PlayGlobeStats {
  window.__acarsPlayStats ??= { arcs: 0, planes: 0, deckFrames: 0, rafFrames: 0, updateMs: 0 };
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

/** Same cadence as the main globe's map clock (S54): planes move 5 times a second. */
const PLANE_CLOCK_MS = 200;
/** Degrees per frame the camera turns in orbit mode (the fps benchmark). */
const ORBIT_DEGREES_PER_FRAME = 0.2;

/**
 * The prototype's world (S45.1): a MapLibre globe with deck.gl drawing into
 * the same WebGL context (interleaved), so arcs depth-sort with the planet.
 * The map is created once; data changes only swap deck.gl layers.
 */
export function PlayGlobe({
  arcs,
  planes,
  orbit = false,
}: {
  arcs: readonly RouteArc[];
  planes: readonly PlaneSchedule[];
  /** Turn the camera every frame, forcing a full redraw (fps benchmark). */
  orbit?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [ready, setReady] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const focusedRef = useRef(false);
  const arcLayerRef = useRef<PathLayer<RouteArc> | null>(null);

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
    arcLayerRef.current = arcLayer(arcs);
    overlayRef.current.setProps({ layers: [arcLayerRef.current] });
    stats().arcs = arcs.length;
    // Open on the player's own network, once.
    const focus = focusedRef.current ? null : playerNetworkFocus(arcs);
    if (focus && mapRef.current) {
      focusedRef.current = true;
      // Tilted, so the arcs read as 3D.
      mapRef.current.jumpTo({ ...focus, pitch: 40 });
    }
  }, [arcs, ready]);

  // The plane clock: write every position into typed buffers, hand them to
  // deck.gl. O(planes) per tick, nothing allocated per plane.
  useEffect(() => {
    if (!ready) return;
    const buffers: PlaneBuffers = allocatePlaneBuffers(planes);
    stats().planes = planes.length;
    let version = 0;
    const tick = () => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const started = performance.now();
      writePlanePositions(planes, nowTick(), buffers);
      version++;
      const layers = arcLayerRef.current ? [arcLayerRef.current] : [];
      overlay.setProps({ layers: [...layers, planeLayer(buffers, version)] });
      const s = stats();
      s.updateMs =
        s.updateMs === 0
          ? performance.now() - started
          : s.updateMs * 0.9 + (performance.now() - started) * 0.1;
    };
    tick();
    const timer = window.setInterval(tick, PLANE_CLOCK_MS);
    return () => window.clearInterval(timer);
  }, [planes, ready]);

  // Frame counter, and the orbiting camera for the benchmark.
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      stats().rafFrames++;
      if (orbit && mapRef.current) {
        mapRef.current.setBearing(mapRef.current.getBearing() + ORBIT_DEGREES_PER_FRAME);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [orbit]);

  // MapLibre makes its container `position: relative`, so size it from a wrapper.
  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        data-testid="play-globe"
        data-ready={ready}
        data-arc-count={ready ? arcs.length : 0}
        data-plane-count={ready ? planes.length : 0}
        className="h-full w-full"
      />
    </div>
  );
}
