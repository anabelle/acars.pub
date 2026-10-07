import * as maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AircraftInstance, Airport, Route } from "@acars/core";
import { getSubsolarPoint } from "@acars/core";
import { aircraftModels } from "@acars/data";
import {
  getBearing,
  getGreatCircleInterpolation,
  pointInViewport,
  routeIntersectsViewport,
} from "./geo.js";
import { BurstPool, createMarkerSlot, type MapBurst, prefersReducedMotion } from "./bursts.js";
import { planCameraFlight } from "./camera.js";
import { buildRouteFeatures, type MapRoute, routeStyleSignature } from "./routeFeatures.js";
import { resolveMapSelection } from "./interactions.js";
import {
  type AirportClass,
  addAirportLayers,
  buildPresenceBadge,
  isMajorAirport,
} from "./layers/airports.js";
import { addFlightLayers, registerAircraftIcons } from "./layers/flights.js";
import { applyGlobeView, globeFitZoom } from "./layers/globeView.js";
import { addNightOverlay, NIGHT_CANVAS_SOURCE, paintNightCanvas } from "./layers/nightOverlay.js";
import {
  addRouteLayers,
  arcCacheKey,
  getSegmentCount,
  routeFlowDash,
  WORLD_LAYER_IDS,
} from "./layers/routes.js";
import { addOpportunityLayers, OPPORTUNITY_SOURCE } from "./layers/opportunities.js";
import { addDataSources } from "./layers/sources.js";
import { buildOpportunityFeatures, type MapOpportunity } from "./opportunities.js";
import { mapRenderStats, trackMapRenders } from "./renderStats.js";
import { initialMapClockState, MAP_CLOCK_MS, planMapClockTick, planWrites } from "./mapClock.js";
import { DEFAULT_MAP_THEME, getMapPalette, getMapStyleUrl, type MapTheme } from "./theme.js";

// Public API kept on this module (re-exported from the package index).
export {
  DARK_MAP_PALETTE,
  DARK_MAP_STYLE_URL,
  DEFAULT_MAP_THEME,
  EARTH_MAP_PALETTE,
  EARTH_MAP_STYLE_URL,
  getMapPalette,
  getMapStyleUrl,
  type MapTheme,
} from "./theme.js";
export { isMajorAirport } from "./layers/airports.js";
export { arcCacheKey, getSegmentCount, ROUTE_PROFIT_COLORS } from "./layers/routes.js";

// Stable defaults: fresh []/new Map() per render would re-run every arc effect.
const NO_ROUTES: MapRoute[] = [];
const NO_RIVAL_ROUTES: Route[] = [];
const NO_LIVERIES = new Map<string, { primary: string; secondary: string }>();
const NO_BURSTS: MapBurst[] = [];
const NO_OPPORTUNITIES: MapOpportunity[] = [];

const aircraftModelMap = new Map(aircraftModels.map((m) => [m.id, m]));

export interface GlobeProps {
  airports: Airport[];
  selectedAirport: Airport | null;
  onAirportSelect: (airport: Airport | null) => void;
  onAircraftSelect?: (aircraftId: string) => void;
  onMapClick?: () => void;
  groundPresence?: Record<string, { color: string; count: number; isPlayer?: boolean }[]>;
  fleet?: AircraftInstance[];
  /** Competitor fleet — aircraft NOT owned by the current player */
  competitorFleet?: AircraftInstance[];
  /** Competitor routes — routes NOT owned by the current player */
  competitorRoutes?: Route[];
  /** The player's routes with frequency and profit (S41: drawn by profit and frequency). */
  playerRoutes?: MapRoute[];
  /** Show rivals' routes and aircraft ("world"); false shows only the player's network. */
  showWorld?: boolean;
  playerLivery?: { primary: string; secondary: string } | null;
  competitorLiveries?: Map<string, { primary: string; secondary: string }>;
  playerHubs?: string[];
  competitorHubColors?: Map<string, string>;
  playerRouteDestinations?: Set<string>;
  tick?: number;
  tickProgress?: number;
  /**
   * Live engine clock as a ref, bypassing React for the 1Hz progress writes.
   * When provided, the RAF animation loop reads tick/tickProgress from here
   * each frame instead of the numeric props (which only re-render on ticks).
   */
  engineClock?: { current: { tick: number; tickProgress: number } };
  /**
   * Floating money labels (S43), e.g. "+$12.3K" at a landing's airport. Pass
   * the recent ones; each id is shown once, through a small pool of labels.
   */
  bursts?: MapBurst[];
  /**
   * Opportunity map (S43): projected profit per day from a hub to candidate
   * destinations, drawn as a heat glow and coloured points. Empty hides it.
   */
  opportunities?: MapOpportunity[];
  /** Map palette mode. Use "dark" for the original night-focused treatment or "light" for the earth-toned style. */
  theme?: MapTheme;
  className?: string;
  style?: React.CSSProperties;
}

// =============================================================================
// --- Globe Component ---
// =============================================================================

export function Globe({
  airports,
  selectedAirport,
  onAirportSelect,
  onAircraftSelect,
  groundPresence,
  fleet = [],
  competitorFleet = [],
  competitorRoutes = NO_RIVAL_ROUTES,
  playerRoutes = NO_ROUTES,
  showWorld = true,
  playerLivery = null,
  competitorLiveries = NO_LIVERIES,
  playerHubs = [],
  competitorHubColors = new Map(),
  playerRouteDestinations = new Set(),
  tick = 0,
  tickProgress = 0,
  engineClock,
  bursts = NO_BURSTS,
  opportunities = NO_OPPORTUNITIES,
  theme = DEFAULT_MAP_THEME,
  className = "",
  style,
  onMapClick,
}: GlobeProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const hasInitialFlied = useRef(false);
  const burstPool = useRef<BurstPool | null>(null);

  // -------------------------------------------------------------------------
  // Optimization 1: O(1) airport lookup via Map<iata, Airport>
  // Eliminates ~240M string comparisons at 10K scale.
  // -------------------------------------------------------------------------
  const airportIndex = useMemo(() => {
    const idx = new Map<string, Airport>();
    for (const a of airports) {
      idx.set(a.iata, a);
    }
    return idx;
  }, [airports]);

  // -------------------------------------------------------------------------
  // Optimization 2: Memoized arc geometry cache for static routes.
  // Global routes rarely change, so we cache their computed LineString
  // coordinates keyed by origin-dest-segments.
  // -------------------------------------------------------------------------
  const arcCache = useRef(new Map<string, [number, number][]>());

  /**
   * Get or compute arc geometry. Returns cached result if available.
   */
  const getOrComputeArc = useCallback(
    (origin: Airport, dest: Airport, segments: number): [number, number][] => {
      const key = arcCacheKey(origin.iata, dest.iata, segments);
      const cached = arcCache.current.get(key);
      if (cached) return cached;

      const points: [number, number][] = [];
      const p1: [number, number] = [origin.longitude, origin.latitude];
      const p2: [number, number] = [dest.longitude, dest.latitude];
      for (let i = 0; i <= segments; i++) {
        points.push(getGreatCircleInterpolation(p1, p2, i / segments));
      }
      arcCache.current.set(key, points);
      return points;
    },
    [],
  );

  // Rivals' routes as map routes, in their livery colour.
  const competitorMapRoutes = useMemo<MapRoute[]>(
    () =>
      competitorRoutes.map((route) => ({
        originIata: route.originIata,
        destinationIata: route.destinationIata,
        ownerPubkey: route.airlinePubkey,
        isPlayer: false,
        frequencyPerWeek: route.frequencyPerWeek,
        color: competitorLiveries.get(route.airlinePubkey)?.primary,
      })),
    [competitorRoutes, competitorLiveries],
  );

  /** Arc features for the player's routes and rivals' routes in view, at the given LOD. */
  const buildArcs = useCallback(
    (bounds: maplibregl.LngLatBounds, segments: number) => {
      const arcFor = (origin: Airport, dest: Airport) => getOrComputeArc(origin, dest, segments);
      const inView = (origin: Airport, dest: Airport) =>
        routeIntersectsViewport(
          origin.longitude,
          origin.latitude,
          dest.longitude,
          dest.latitude,
          bounds,
        );
      return {
        arcFeatures: buildRouteFeatures(playerRoutes, airportIndex, arcFor, inView),
        globalArcFeatures: buildRouteFeatures(competitorMapRoutes, airportIndex, arcFor, inView),
      };
    },
    [playerRoutes, competitorMapRoutes, airportIndex, getOrComputeArc],
  );

  // Invalidate arc cache when zoom changes LOD tier (segment count changes).
  const lastSegmentCount = useRef<number>(0);
  // Signature + payload cache for the airports source: lets per-tick
  // effect runs no-op when classification/presence data is unchanged.
  const lastAirportDataSig = useRef<string | null>(null);
  const lastAirportGeojson = useRef<FeatureCollection | null>(null);
  // Signature cache for the arcs/global-arcs sources (see arcs effect).
  const lastArcsSig = useRef<string | null>(null);

  // -------------------------------------------------------------------------
  // Refs for requestAnimationFrame-based flight animation
  // -------------------------------------------------------------------------
  const rafId = useRef<number>(0);
  const nightOverlayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestTick = useRef(tick);
  const latestTickProgress = useRef(tickProgress);
  const latestFleet = useRef(fleet);
  const latestGlobalFleet = useRef(competitorFleet);
  const latestPlayerLivery = useRef(playerLivery);
  const latestCompetitorLiveries = useRef(competitorLiveries);
  const latestPlayerHubs = useRef(playerHubs);
  const latestCompetitorHubColors = useRef(competitorHubColors);
  const latestPlayerRouteDestinations = useRef(playerRouteDestinations);
  const latestGroundPresence = useRef(groundPresence);
  const latestOnAirportSelect = useRef(onAirportSelect);
  const latestOnAircraftSelect = useRef(onAircraftSelect);
  const latestOnMapClick = useRef(onMapClick);
  const latestShowWorld = useRef(showWorld);
  const latestPlayerRouteCount = useRef(playerRoutes.length);

  // Keep refs in sync with props (avoid stale closures in RAF loop).
  // Consolidated into one effect to avoid 11 separate scheduler entries.
  useEffect(() => {
    latestOnAirportSelect.current = onAirportSelect;
    latestOnAircraftSelect.current = onAircraftSelect;
    latestOnMapClick.current = onMapClick;
    latestShowWorld.current = showWorld;
    latestPlayerRouteCount.current = playerRoutes.length;
    latestTick.current = tick;
    latestTickProgress.current = tickProgress;
    latestFleet.current = fleet;
    latestGlobalFleet.current = competitorFleet;
    latestPlayerLivery.current = playerLivery;
    latestCompetitorLiveries.current = competitorLiveries;
    latestPlayerHubs.current = playerHubs;
    latestCompetitorHubColors.current = competitorHubColors;
    latestPlayerRouteDestinations.current = playerRouteDestinations;
    latestGroundPresence.current = groundPresence;
  }, [
    onAirportSelect,
    onAircraftSelect,
    onMapClick,
    showWorld,
    playerRoutes.length,
    tick,
    tickProgress,
    fleet,
    competitorFleet,
    playerLivery,
    competitorLiveries,
    playerHubs,
    competitorHubColors,
    playerRouteDestinations,
    groundPresence,
  ]);

  // =========================================================================
  // Map Initialization (runs once)
  //
  // React 18+ StrictMode double-mounts in dev: Mount -> Unmount -> Re-mount.
  // Calling map.remove() synchronously on unmount destroys the WebGL context
  // before the re-mount can rescue it. We defer cleanup via setTimeout so
  // StrictMode's immediate re-mount can cancel the pending removal.
  // =========================================================================
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapThemePalette = useMemo(() => getMapPalette(theme), [theme]);

  useEffect(() => {
    // If a deferred cleanup is pending from a previous unmount, cancel it —
    // StrictMode is re-mounting us and the map is still alive.
    if (cleanupTimer.current) {
      clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    }

    // If the map already exists (StrictMode re-mount), just re-sync state.
    if (mapRef.current) {
      // The map is still attached to our container div (React reuses the
      // same DOM node for the re-mount), so we just need to ensure our
      // React state reflects that the map is ready.
      if (mapRef.current.loaded()) {
        setMapLoaded(true);
      } else {
        mapRef.current.once("load", () => setMapLoaded(true));
      }
      return () => {
        cleanupTimer.current = setTimeout(() => {
          mapRef.current?.remove();
          mapRef.current = null;
        }, 100);
      };
    }

    if (!mapContainer.current) return;

    // Load saved view state
    const savedView = localStorage.getItem("acars_map_view");
    let initialCenter: [number, number] = [0, 20];
    // First visit: the whole planet, seen from space.
    let initialZoom = globeFitZoom(
      mapContainer.current.clientWidth,
      mapContainer.current.clientHeight,
    );

    if (savedView) {
      try {
        const { center, zoom } = JSON.parse(savedView);
        initialCenter = center;
        initialZoom = zoom;
        hasInitialFlied.current = true;
      } catch (e) {
        console.warn("Failed to parse saved map view", e);
      }
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyleUrl(theme),
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      clickTolerance: 10,
    });

    map.doubleClickZoom.disable();
    trackMapRenders(map);

    // Persist view changes
    const saveView = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      localStorage.setItem(
        "acars_map_view",
        JSON.stringify({
          center: [center.lng, center.lat],
          zoom,
        }),
      );
    };

    map.on("moveend", saveView);
    map.on("zoomend", saveView);
    let cursorFrame: number | null = null;
    let pendingCursorPoint: { x: number; y: number } | null = null;

    // Projection and sky are part of the style: re-apply on every style load.
    map.on("style.load", () => applyGlobeView(map, mapThemePalette));

    map.on("load", () => {
      setMapLoaded(true);

      registerAircraftIcons(map);
      nightCanvasRef.current = addNightOverlay(map, mapThemePalette.nightTint);
      addDataSources(map);
      addRouteLayers(map, mapThemePalette);
      addAirportLayers(map, mapThemePalette);
      // Under the hub glow and airports, above the routes.
      addOpportunityLayers(map, "active-hub-glow");
      addFlightLayers(map, mapThemePalette);
      const queryRenderedFeatures = map.queryRenderedFeatures.bind(map);
      const setCursor = (cursor: string) => {
        map.getCanvas().style.cursor = cursor;
      };
      const updateCursor = () => {
        cursorFrame = null;

        if (!pendingCursorPoint) return;

        const selection = resolveMapSelection(pendingCursorPoint, queryRenderedFeatures);
        setCursor(selection ? "pointer" : "");
      };

      map.on("click", (e) => {
        const selection = resolveMapSelection(e.point, queryRenderedFeatures);

        if (selection?.type === "airport") {
          latestOnAirportSelect.current?.(selection.airport);
          return;
        }

        if (selection?.type === "aircraft") {
          latestOnAircraftSelect.current?.(selection.aircraftId);
          return;
        }

        latestOnMapClick.current?.();
      });

      map.on("mousemove", (e) => {
        pendingCursorPoint = e.point;
        if (cursorFrame !== null) return;
        cursorFrame = requestAnimationFrame(updateCursor);
      });

      map.on("mouseout", () => {
        pendingCursorPoint = null;
        if (cursorFrame !== null) {
          cancelAnimationFrame(cursorFrame);
          cursorFrame = null;
        }
        setCursor("");
      });
    });

    mapRef.current = map;
    return () => {
      if (cursorFrame !== null) {
        cancelAnimationFrame(cursorFrame);
      }
      cleanupTimer.current = setTimeout(() => {
        mapRef.current?.remove();
        mapRef.current = null;
      }, 100);
    };
  }, [theme, mapThemePalette]);

  // =========================================================================
  // Sync airports & arcs (reactive to fleet/routes state changes)
  //
  // Optimizations applied:
  //  - O(1) airport lookups via airportIndex
  //  - Viewport culling: skip arcs outside current view
  //  - LOD: adaptive segment count based on zoom level
  //  - Arc memoization: cache computed arc geometry
  // =========================================================================
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const zoom = map.getZoom();
    const segments = getSegmentCount(zoom);
    const bounds = map.getBounds();

    // Invalidate arc cache if LOD tier changed
    if (segments !== lastSegmentCount.current) {
      arcCache.current.clear();
      lastSegmentCount.current = segments;
    }

    const classifyAirport = (
      airport: Airport,
    ): {
      airportClass: AirportClass;
      competitorHubColor?: string;
      playerHubColor?: string | null;
    } => {
      const hubs = playerHubs;
      const routeDestinations = playerRouteDestinations;
      const competitorColors = competitorHubColors;
      const playerColor = latestPlayerLivery.current?.primary ?? null;

      if (hubs[0] === airport.iata) {
        return { airportClass: "active-hub", playerHubColor: playerColor };
      }
      if (hubs.includes(airport.iata)) {
        return { airportClass: "player-hub", playerHubColor: playerColor };
      }
      const competitorHubColor = competitorColors.get(airport.iata);
      if (competitorHubColor) return { airportClass: "competitor-hub", competitorHubColor };
      if (routeDestinations.has(airport.iata)) return { airportClass: "route-dest" };
      if (isMajorAirport(airport)) return { airportClass: "major" };
      return { airportClass: "default" };
    };

    // --- Airport GeoJSON (classified) ---
    const presence = latestGroundPresence.current;
    // Cheap signature over every input that affects the airports dataset:
    // classification + presence composition + per-airport counts (hover
    // panels read them). Fleet-identity ticks that change none of these
    // skip the 6072-feature rebuild + ~2MB setData clone (audit C1).
    let dataSig = `${playerHubs.join(",")}|${playerRouteDestinations.size}:${[...playerRouteDestinations].sort().join(",")}|`;
    for (const [iata, color] of competitorHubColors) {
      dataSig += `${iata}=${color};`;
    }
    dataSig += `|${latestPlayerLivery.current?.primary ?? ""}`;
    for (const iata of Object.keys(presence ?? {})) {
      const segs = presence?.[iata] ?? [];
      dataSig += `;${iata}:${segs.map((seg) => `${seg.color}=${seg.count}`).join(",")}`;
    }
    const airportsDataUnchanged = dataSig === lastAirportDataSig.current;
    lastAirportDataSig.current = dataSig;
    const existingPresenceImages = new Set(
      map.listImages().filter((name) => name.startsWith("presence-")),
    );
    const activePresenceImages = new Set<string>();

    const airportGeojson: FeatureCollection =
      airportsDataUnchanged && lastAirportGeojson.current
        ? lastAirportGeojson.current
        : {
            type: "FeatureCollection",
            features: airports.map((a) => {
              const classification = classifyAirport(a);
              const presenceSegments = presence?.[a.iata] ?? [];
              // Icon key by COMPOSITION only (colors, ordered) — counts live in
              // properties. A count change no longer re-creates the image.
              const presenceKey = presenceSegments.length
                ? `presence-${a.iata}-${presenceSegments.map((segment) => segment.color).join("-")}`
                : null;

              if (presenceKey && !map.hasImage(presenceKey)) {
                const canvas = buildPresenceBadge(presenceSegments, 64);
                map.addImage(presenceKey, canvas, { pixelRatio: 2 });
              }
              if (presenceKey) activePresenceImages.add(presenceKey);

              return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [a.longitude, a.latitude] },
                properties: {
                  ...a,
                  groundPresenceCount: presenceSegments.reduce(
                    (sum, segment) => sum + segment.count,
                    0,
                  ),
                  groundPresenceIcon: presenceKey,
                  ...classification,
                },
              };
            }),
          };

    if (!airportsDataUnchanged) {
      for (const imageId of existingPresenceImages) {
        if (!activePresenceImages.has(imageId)) {
          map.removeImage(imageId);
        }
      }
      lastAirportGeojson.current = airportGeojson;
    }

    // --- Route arcs: the player's routes and rivals' (culling + LOD + caching) ---
    const { arcFeatures, globalArcFeatures } = buildArcs(bounds, segments);

    if (!airportsDataUnchanged) {
      (map.getSource("airports") as maplibregl.GeoJSONSource)?.setData(airportGeojson);
    }
    // Signature no-op for arcs: identity churn in fleet/routes deps re-runs
    // this effect every tick even when the visible arc set is byte-identical.
    // Skipping the setData avoids a full re-tiling + GPU re-upload of both
    // sources. Bounds are part of the signature so pans/zooms always refresh.
    const firstArcCoords = arcFeatures[0]?.geometry as { coordinates?: unknown[] } | undefined;
    const lastArcCoords = arcFeatures[arcFeatures.length - 1]?.geometry as
      | { coordinates?: unknown[] }
      | undefined;
    const arcsSig = [
      map.getBounds().toString(),
      arcFeatures.length,
      firstArcCoords?.coordinates?.length ?? 0,
      lastArcCoords?.coordinates?.length ?? 0,
      globalArcFeatures.length,
      routeStyleSignature(playerRoutes),
      routeStyleSignature(competitorMapRoutes),
    ].join("|");
    if (arcsSig !== lastArcsSig.current) {
      lastArcsSig.current = arcsSig;
      (map.getSource("arcs") as maplibregl.GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: arcFeatures,
      });
      (map.getSource("global-arcs") as maplibregl.GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: globalArcFeatures,
      });
    }
  }, [
    airports,
    mapLoaded,
    fleet,
    competitorRoutes,
    playerRoutes,
    competitorMapRoutes,
    buildArcs,
    airportIndex,
    getOrComputeArc,
    playerHubs,
    competitorHubColors,
    playerRouteDestinations,
  ]);

  // =========================================================================
  // Re-render arcs on viewport change (zoom/pan) for culling + LOD
  //
  // We debounce this to avoid recomputing on every pixel of a pan gesture.
  // =========================================================================
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const onViewChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Re-trigger arc computation by touching fleet/routes deps
        // We do this by dispatching the same update logic inline.
        const zoom = map.getZoom();
        const segments = getSegmentCount(zoom);
        const bounds = map.getBounds();

        if (segments !== lastSegmentCount.current) {
          arcCache.current.clear();
          lastSegmentCount.current = segments;
        }

        const { arcFeatures, globalArcFeatures } = buildArcs(bounds, segments);

        (map.getSource("arcs") as maplibregl.GeoJSONSource)?.setData({
          type: "FeatureCollection",
          features: arcFeatures,
        });
        (map.getSource("global-arcs") as maplibregl.GeoJSONSource)?.setData({
          type: "FeatureCollection",
          features: globalArcFeatures,
        });
      }, 150); // 150ms debounce
    };

    map.on("moveend", onViewChange);
    map.on("zoomend", onViewChange);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      map.off("moveend", onViewChange);
      map.off("zoomend", onViewChange);
    };
  }, [mapLoaded, buildArcs]);

  // Floating money labels (S43): one small pool of markers per map. The pool
  // effect is declared first so it exists before bursts are pushed.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const pool = new BurstPool(() =>
      createMarkerSlot(
        map,
        (element) => new maplibregl.Marker({ element, anchor: "bottom", offset: [0, -12] }),
        prefersReducedMotion,
      ),
    );
    burstPool.current = pool;
    return () => {
      pool.clear();
      burstPool.current = null;
    };
  }, [mapLoaded]);

  useEffect(() => {
    if (mapLoaded) burstPool.current?.push(bursts);
  }, [mapLoaded, bursts]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    (mapRef.current.getSource(OPPORTUNITY_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(
      {
        type: "FeatureCollection",
        features: buildOpportunityFeatures(opportunities),
      },
    );
  }, [mapLoaded, opportunities]);

  // =========================================================================
  // REAL-TIME MOVEMENT: requestAnimationFrame-based 60fps interpolation
  //
  // Instead of computing positions every 1s via setInterval, we run a
  // smooth RAF loop that interpolates aircraft positions at display refresh
  // rate. This uses sub-tick progress from the engine store combined with
  // frame-level interpolation for buttery smooth movement.
  //
  // Optimizations applied:
  //  - O(1) airport lookups
  //  - Viewport culling: skip off-screen aircraft
  //  - RAF loop with map idle detection (pauses when map is hidden)
  // =========================================================================
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const updateNightOverlay = () => {
      if (!nightCanvasRef.current) return;
      const canvas = nightCanvasRef.current;
      const sun = getSubsolarPoint(new Date());
      // Use requestIdleCallback when available so the ~2ms pixel-fill doesn't
      // land on a busy animation frame.  Falls back to a simple timeout.
      const paintAndPulse = () => {
        paintNightCanvas(canvas, sun.lat, sun.lng, mapThemePalette.nightTint);
        // The canvas source is paused (animate:false): pulse play()/pause()
        // to upload the freshly painted texture exactly once. pause() runs
        // prepare() synchronously, so no continuous repaint loop starts.
        const source = map.getSource(NIGHT_CANVAS_SOURCE) as maplibregl.CanvasSource | undefined;
        source?.play();
        source?.pause();
      };
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(paintAndPulse, {
          timeout: 2000,
        });
      } else {
        setTimeout(paintAndPulse, 0);
      }
    };

    updateNightOverlay();
    nightOverlayTimer.current = setInterval(updateNightOverlay, 60000);

    const processFleet = (
      targetFleet: AircraftInstance[],
      currentTick: number,
      currentProgress: number,
      bounds: maplibregl.LngLatBounds,
      resolveColor: (ac: AircraftInstance) => { primary?: string; secondary?: string } | undefined,
      baseSize: number,
      now: number,
    ): Feature[] => {
      const features: Feature[] = [];
      for (const ac of targetFleet) {
        if (ac.status !== "enroute" || !ac.flight) continue;
        const f = ac.flight;
        const origin = airportIndex.get(f.originIata);
        const dest = airportIndex.get(f.destinationIata);
        if (!origin || !dest) continue;

        const duration = Math.max(1, f.arrivalTick - f.departureTick);
        const elapsed = currentTick - f.departureTick + currentProgress;
        const progress = Math.max(0, Math.min(1, elapsed / duration));

        const p1: [number, number] = [origin.longitude, origin.latitude];
        const p2: [number, number] = [dest.longitude, dest.latitude];
        const coords = getGreatCircleInterpolation(p1, p2, progress);

        // Viewport culling for individual aircraft
        if (!pointInViewport(coords[0], coords[1], bounds)) continue;

        // Compute bearing analytically at current progress without a second
        // SLERP call — sample a tiny step forward (0.5% of route) instead.
        // This halves getGreatCircleInterpolation calls per frame.
        const nextCoords = getGreatCircleInterpolation(p1, p2, Math.min(1, progress + 0.005));
        const bearing = getBearing(coords, nextCoords);

        const model = aircraftModelMap.get(ac.modelId);
        const familyId = model?.familyId || "a320";
        const wingspanM = model?.wingspanM || 35.8;
        const colors = resolveColor(ac);

        // Per-aircraft strobe phase uses ID + departure tick to avoid synchronization.
        // 1.8s cycle with 500ms pulse keeps the flash clearly visible.
        const idPhase =
          ((ac.id.charCodeAt(0) || 0) * 31 +
            (ac.id.charCodeAt(ac.id.length - 1) || 0) * 17 +
            f.departureTick) %
          1800;
        const strobeOn = (now + idPhase) % 1800 < 500 ? 1 : 0;

        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: coords },
          properties: {
            id: ac.id,
            bearing,
            familyId,
            sizeScale: (wingspanM / 35.8) * baseSize,
            strobeOn,
            ...(colors?.primary ? { primaryColor: colors.primary } : {}),
            ...(colors?.secondary ? { secondaryColor: colors.secondary } : {}),
          },
        });
      }
      return features;
    };

    let isAnimating = true;
    // Route flow (dashes travelling origin → destination): off for reduced motion.
    const flowMotion = !(
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    let clock = initialMapClockState();

    let lastFrame = 0;
    const animate = (now: number) => {
      if (!isAnimating || !mapRef.current) return;
      if (document.hidden) {
        rafId.current = requestAnimationFrame(animate);
        return;
      }
      // One map clock (S54): flight positions and the route-flow step are
      // written together every MAP_CLOCK_MS, so MapLibre redraws once per
      // tick, and not at all when nothing changed. A setData re-upload is a
      // structured clone + worker re-tiling + GPU re-upload: far too costly
      // at display rate, and 5 a second still reads as smooth motion.
      if (now - lastFrame < MAP_CLOCK_MS) {
        rafId.current = requestAnimationFrame(animate);
        return;
      }
      lastFrame = now;

      const bounds = map.getBounds();
      const currentTick = engineClock?.current.tick ?? latestTick.current;
      const currentProgress = engineClock?.current.tickProgress ?? latestTickProgress.current;

      const flightFeatures = processFleet(
        latestFleet.current,
        currentTick,
        currentProgress,
        bounds,
        () => latestPlayerLivery.current || undefined,
        1.1,
        now,
      );
      // "My network" view: rivals' aircraft are hidden, so don't interpolate them.
      const globalFlightFeatures = !latestShowWorld.current
        ? []
        : processFleet(
            latestGlobalFleet.current,
            currentTick,
            currentProgress,
            bounds,
            (ac) => latestCompetitorLiveries.current.get(ac.ownerPubkey),
            0.8,
            now,
          );

      const flowOn =
        flowMotion &&
        latestPlayerRouteCount.current > 0 &&
        Boolean(map.getLayer("arcs-flow-layer"));
      const plan = planMapClockTick(clock, {
        flights: flightFeatures.length,
        globalFlights: globalFlightFeatures.length,
        flowDash: flowOn ? routeFlowDash(now) : null,
      });
      clock = plan.next;
      if (planWrites(plan)) mapRenderStats().requests++;
      if (plan.uploadFlights) {
        (map.getSource("flights") as maplibregl.GeoJSONSource)?.setData({
          type: "FeatureCollection",
          features: flightFeatures,
        });
      }
      if (plan.uploadGlobalFlights) {
        (map.getSource("global-flights") as maplibregl.GeoJSONSource)?.setData({
          type: "FeatureCollection",
          features: globalFlightFeatures,
        });
      }
      if (plan.flowDash) {
        map.setPaintProperty("arcs-flow-layer", "line-dasharray", [...plan.flowDash]);
      }

      rafId.current = requestAnimationFrame(animate);
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      isAnimating = false;
      if (nightOverlayTimer.current) {
        clearInterval(nightOverlayTimer.current);
        nightOverlayTimer.current = null;
      }
      cancelAnimationFrame(rafId.current);
    };
  }, [mapLoaded, airportIndex, mapThemePalette]);

  // =========================================================================
  // "My network" / "world" toggle: rivals' routes and aircraft on or off.
  // =========================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) return;
    for (const id of WORLD_LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", showWorld ? "visible" : "none");
    }
  }, [showWorld, mapLoaded]);

  // =========================================================================
  // Initial fly-to on first airport selection or focus change
  // =========================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map || !selectedAirport) return;

    // First focus (your hub on load or in onboarding) lands at hub zoom;
    // later ones keep the player's zoom if they are already closer in.
    const first = !hasInitialFlied.current;
    hasInitialFlied.current = true;
    const targetZoom = first ? 4.5 : Math.max(3.2, map.getZoom());
    const center = map.getCenter();
    const canvas = map.getCanvas();
    const plan = planCameraFlight(
      { lng: center.lng, lat: center.lat },
      { lng: selectedAirport.longitude, lat: selectedAirport.latitude },
      { current: map.getZoom(), target: targetZoom },
      { width: canvas.clientWidth, height: canvas.clientHeight },
    );
    // Not "essential": people who prefer reduced motion get a jump cut.
    map.flyTo({
      center: [selectedAirport.longitude, selectedAirport.latitude],
      zoom: targetZoom,
      duration: plan.duration,
      ...(plan.minZoom !== undefined ? { minZoom: plan.minZoom } : {}),
    });
  }, [selectedAirport, mapLoaded]);

  return (
    <div
      ref={mapContainer}
      className={`globe-container ${className}`}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        ...style,
      }}
    />
  );
}
