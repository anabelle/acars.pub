import { DARK_MAP_STYLE_URL, getMapPalette } from "@acars/map";
import { bootMark } from "@acars/store";
import type { Layer } from "@deck.gl/core";
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
import { networkAirports, playerNetworkFocus, type RouteArc } from "./arcs";
import { airportLayer, arcLayer, planeLayer } from "./layers";
import { shimMapTransform } from "./mapCompat";
import { bestPick, type PlaySelection, selectionFromPick } from "./selection";
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
    /** Screen pixel of a surface point, for e2e clicks (prototype only). */
    __acarsPlayProject?: (lng: number, lat: number) => [number, number];
  }
}

function stats(): PlayGlobeStats {
  window.__acarsPlayStats ??= { arcs: 0, planes: 0, deckFrames: 0, rafFrames: 0, updateMs: 0 };
  return window.__acarsPlayStats;
}

/** Same cadence as the main globe's map clock (S54): planes move 5 times a second. */
const PLANE_CLOCK_MS = 200;
/** Degrees per frame the camera turns in orbit mode (the fps benchmark). */
const ORBIT_DEGREES_PER_FRAME = 0.2;

interface PlayLayers {
  arcs: Layer | null;
  airports: Layer | null;
  planes: Layer | null;
}

function drawLayers(overlay: MapboxOverlay | null, { arcs, airports, planes }: PlayLayers): void {
  overlay?.setProps({ layers: [arcs, airports, planes].filter((l): l is Layer => !!l) });
}

/**
 * The prototype's world (S45.1): a MapLibre globe with deck.gl drawing into
 * the same WebGL context (interleaved), so arcs depth-sort with the planet.
 * The map is created once; data changes only swap deck.gl layers.
 */
export function PlayGlobe({
  arcs,
  planes,
  orbit = false,
  onSelect,
}: {
  arcs: readonly RouteArc[];
  planes: readonly PlaneSchedule[];
  /** Turn the camera every frame, forcing a full redraw (fps benchmark). */
  orbit?: boolean;
  /** A click on a route, airport or plane; null for empty space. */
  onSelect?: (selection: PlaySelection | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [ready, setReady] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const focusedRef = useRef(false);
  // One ref per layer; `drawLayers` hands deck.gl whatever is current.
  const layersRef = useRef<PlayLayers>({ arcs: null, airports: null, planes: null });
  // The click handler lives on the overlay (created once): it reads the
  // latest props through refs.
  const planesRef = useRef(planes);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    planesRef.current = planes;
    onSelectRef.current = onSelect;
  });

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
      pickingRadius: 6,
      onClick: (info) => {
        // Everything under the cursor, then the most specific thing wins (a
        // hub's dot over the arcs that end on it).
        const picks = overlay.pickMultipleObjects({ x: info.x, y: info.y, radius: 6 });
        const pick = bestPick(
          picks.map((p) => ({ layerId: p.layer?.id, index: p.index, object: p.object })),
        );
        onSelectRef.current?.(pick ? selectionFromPick(pick, planesRef.current) : null);
      },
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
    map.once("load", () => {
      bootMark("play: globe loaded");
      setReady(true);
    });
    window.__acarsPlayProject = (lng, lat) => {
      const point = map.project([lng, lat]);
      const box = container.getBoundingClientRect();
      return [box.left + point.x, box.top + point.y];
    };
    return () => {
      delete window.__acarsPlayProject;
      overlayRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !overlayRef.current) return;
    layersRef.current.arcs = arcLayer(arcs);
    layersRef.current.airports = airportLayer(networkAirports(arcs));
    drawLayers(overlayRef.current, layersRef.current);
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
    if (planes.length > 0) bootMark("play: planes ready", `${planes.length}`);
    stats().planes = planes.length;
    let version = 0;
    const tick = () => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const started = performance.now();
      writePlanePositions(planes, nowTick(), buffers);
      version++;
      layersRef.current.planes = planeLayer(buffers, version);
      drawLayers(overlay, layersRef.current);
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
