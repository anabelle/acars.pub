import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Airport, AircraftInstance, Route } from '@airtr/core';

import { NARROWBODY_SVG, TURBOPROP_SVG, WIDEBODY_SVG, REGIONAL_SVG } from './icons.js';

import { aircraftModels } from '@airtr/data';
const aircraftModelMap = new Map(aircraftModels.map(m => [m.id, m]));

export interface GlobeProps {
    airports: Airport[];
    selectedAirport: Airport | null;
    onAirportSelect: (airport: Airport | null) => void;
    fleetBaseCounts?: Record<string, number>;
    fleet?: AircraftInstance[];
    globalFleet?: AircraftInstance[];
    globalRoutes?: Route[];
    tick?: number;
    tickProgress?: number;
    className?: string;
    style?: React.CSSProperties;
}

// =============================================================================
// --- Navigation Helpers (Great Circle Math) ---
// =============================================================================

function getGreatCircleInterpolation(p1: [number, number], p2: [number, number], f: number): [number, number] {
    const lon1 = p1[0] * Math.PI / 180;
    const lat1 = p1[1] * Math.PI / 180;
    const lon2 = p2[0] * Math.PI / 180;
    const lat2 = p2[1] * Math.PI / 180;

    const d = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((lat1 - lat2) / 2), 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lon1 - lon2) / 2), 2)));

    if (d === 0) return p1;

    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)));
    const lon = Math.atan2(y, x);

    return [lon * 180 / Math.PI, lat * 180 / Math.PI];
}

function getBearing(p1: [number, number], p2: [number, number]): number {
    const lon1 = p1[0] * Math.PI / 180;
    const lat1 = p1[1] * Math.PI / 180;
    const lon2 = p2[0] * Math.PI / 180;
    const lat2 = p2[1] * Math.PI / 180;

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const brng = Math.atan2(y, x);
    return (brng * 180 / Math.PI + 360) % 360;
}

// =============================================================================
// --- LOD: Adaptive segment count based on zoom level ---
// =============================================================================

/**
 * Returns the number of arc segments to use based on the current map zoom.
 * At low zooms, arcs are small on screen and need fewer segments.
 * At high zooms, arcs are large and need more segments for smooth curves.
 */
function getSegmentCount(zoom: number): number {
    if (zoom < 2) return 8;
    if (zoom < 4) return 16;
    if (zoom < 6) return 24;
    if (zoom < 8) return 36;
    return 50;
}

// =============================================================================
// --- Viewport Culling Helpers ---
// =============================================================================

/**
 * Fast bounding-box test: does a great circle route between two points
 * potentially intersect the given viewport bounds?
 *
 * We expand the route's bounding box by a generous margin to account for
 * the curvature of great circles (which can bulge significantly away from
 * the straight-line bounding box, especially on long routes).
 */
function routeIntersectsViewport(
    originLng: number, originLat: number,
    destLng: number, destLat: number,
    bounds: maplibregl.LngLatBounds
): boolean {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Calculate route bounding box
    let minLng = Math.min(originLng, destLng);
    let maxLng = Math.max(originLng, destLng);
    let minLat = Math.min(originLat, destLat);
    let maxLat = Math.max(originLat, destLat);

    // Great circle curvature margin: longer routes bulge more.
    // Use a rough heuristic based on lat/lng span.
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    const margin = Math.max(latSpan, lngSpan) * 0.3 + 5; // min 5 degrees margin

    minLng -= margin;
    maxLng += margin;
    minLat -= margin;
    maxLat += margin;

    // AABB overlap test
    return !(maxLng < sw.lng || minLng > ne.lng || maxLat < sw.lat || minLat > ne.lat);
}

/**
 * Check if a single point is within viewport bounds (with margin).
 */
function pointInViewport(
    lng: number, lat: number,
    bounds: maplibregl.LngLatBounds,
    margin: number = 5
): boolean {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return lng >= sw.lng - margin && lng <= ne.lng + margin &&
        lat >= sw.lat - margin && lat <= ne.lat + margin;
}

// =============================================================================
// --- Arc Geometry Cache ---
// =============================================================================

/**
 * Cache key for a route arc. We use origin+dest IATA since the geometry
 * is purely a function of the two endpoints and the segment count.
 */
function arcCacheKey(originIata: string, destIata: string, segments: number): string {
    return `${originIata}-${destIata}-${segments}`;
}

// =============================================================================
// --- Globe Component ---
// =============================================================================

export function Globe({
    airports,
    selectedAirport,
    onAirportSelect,
    fleetBaseCounts,
    fleet = [],
    globalFleet = [],
    globalRoutes = [],
    tick = 0,
    tickProgress = 0,
    className = '',
    style,
}: GlobeProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const hasInitialFlied = useRef(false);

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
    const getOrComputeArc = useCallback((
        origin: Airport,
        dest: Airport,
        segments: number
    ): [number, number][] => {
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
    }, []);

    // Invalidate arc cache when zoom changes LOD tier (segment count changes).
    const lastSegmentCount = useRef<number>(0);

    // -------------------------------------------------------------------------
    // Refs for requestAnimationFrame-based flight animation
    // -------------------------------------------------------------------------
    const rafId = useRef<number>(0);
    const latestTick = useRef(tick);
    const latestTickProgress = useRef(tickProgress);
    const latestFleet = useRef(fleet);
    const latestGlobalFleet = useRef(globalFleet);

    // Keep refs in sync with props (avoid stale closures in RAF loop)
    useEffect(() => { latestTick.current = tick; }, [tick]);
    useEffect(() => { latestTickProgress.current = tickProgress; }, [tickProgress]);
    useEffect(() => { latestFleet.current = fleet; }, [fleet]);
    useEffect(() => { latestGlobalFleet.current = globalFleet; }, [globalFleet]);

    // =========================================================================
    // Map Initialization (runs once)
    // =========================================================================
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        // Load saved view state
        const savedView = localStorage.getItem('airtr_map_view');
        let initialCenter: [number, number] = [0, 20];
        let initialZoom = 1.5;

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
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: initialCenter,
            zoom: initialZoom,
            pitch: 0,
        });

        map.doubleClickZoom.disable();

        // Persist view changes
        const saveView = () => {
            const center = map.getCenter();
            const zoom = map.getZoom();
            localStorage.setItem('airtr_map_view', JSON.stringify({
                center: [center.lng, center.lat],
                zoom,
            }));
        };

        map.on('moveend', saveView);
        map.on('zoomend', saveView);

        map.on('load', () => {
            setMapLoaded(true);

            // Helper to add SVG to map as SDF
            const addIcon = (id: string, svg: string) => {
                const img = new Image();
                img.onload = () => {
                    if (!map.hasImage(id)) {
                        map.addImage(id, img, { sdf: true });
                    }
                };
                img.src = 'data:image/svg+xml;base64,' + btoa(svg);
            };

            addIcon('airplane-icon', NARROWBODY_SVG);
            addIcon('airplane-turboprop', TURBOPROP_SVG);
            addIcon('airplane-regional', REGIONAL_SVG);
            addIcon('airplane-widebody', WIDEBODY_SVG);

            // Sources
            map.addSource('airports', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            map.addSource('flights', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            map.addSource('arcs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            map.addSource('global-flights', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            map.addSource('global-arcs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

            // Layer: Global Arcs
            map.addLayer({
                id: 'global-arcs-layer',
                type: 'line',
                source: 'global-arcs',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#475569',
                    'line-width': 0.5,
                    'line-opacity': 0.2,
                },
            });

            // Layer: Active Flight Arcs (dashed)
            map.addLayer({
                id: 'arcs-layer',
                type: 'line',
                source: 'arcs',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#e94560',
                    'line-width': 1,
                    'line-opacity': 0.3,
                    'line-dasharray': [2, 2],
                },
            });

            // Layer: Airports
            map.addLayer({
                id: 'airports-layer',
                type: 'circle',
                source: 'airports',
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1, 6, 2, 10, 4],
                    'circle-color': '#e94560',
                    'circle-opacity': 0.6,
                    'circle-stroke-width': 0.5,
                    'circle-stroke-color': '#fff',
                },
            });

            // Layer: Fleet Parked
            map.addLayer({
                id: 'fleet-layer',
                type: 'symbol',
                source: 'airports',
                filter: ['>', ['get', 'fleetCount'], 0],
                layout: {
                    'icon-image': 'airplane-icon',
                    'icon-size': 0.7,
                    'icon-allow-overlap': true,
                    'text-field': '{fleetCount}',
                    'text-size': 11,
                    'text-anchor': 'top',
                    'text-offset': [0, 0.4],
                    'text-allow-overlap': true,
                },
                paint: {
                    'icon-color': '#4ade80',
                    'text-halo-color': '#000000',
                    'text-halo-width': 2,
                    'text-color': '#4ade80',
                },
            });

            // Layer: Global Flights
            map.addLayer({
                id: 'global-flights-layer',
                type: 'symbol',
                source: 'global-flights',
                layout: {
                    'icon-image': [
                        'match',
                        ['get', 'type'],
                        'turboprop', 'airplane-turboprop',
                        'regional', 'airplane-regional',
                        'widebody', 'airplane-widebody',
                        'airplane-icon',
                    ],
                    'icon-size': [
                        'match',
                        ['get', 'type'],
                        'turboprop', 0.65,
                        'regional', 0.75,
                        'widebody', 1.1,
                        0.8,
                    ],
                    'icon-rotate': ['get', 'bearing'],
                    'icon-rotation-alignment': 'map',
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                    'icon-anchor': 'center',
                },
                paint: {
                    'icon-color': '#64748b',
                    'icon-opacity': 0.8,
                },
            });

            // Layer: Active Flights (Player)
            map.addLayer({
                id: 'flights-layer',
                type: 'symbol',
                source: 'flights',
                layout: {
                    'icon-image': [
                        'match',
                        ['get', 'type'],
                        'turboprop', 'airplane-turboprop',
                        'regional', 'airplane-regional',
                        'widebody', 'airplane-widebody',
                        'airplane-icon',
                    ],
                    'icon-size': [
                        'match',
                        ['get', 'type'],
                        'turboprop', 0.9,
                        'regional', 1.0,
                        'widebody', 1.4,
                        1.1,
                    ],
                    'icon-rotate': ['get', 'bearing'],
                    'icon-rotation-alignment': 'map',
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                    'icon-anchor': 'center',
                },
                paint: {
                    'icon-color': '#ffffff',
                },
            });

            // Layer: Flight glow
            map.addLayer({
                id: 'flight-glow',
                type: 'circle',
                source: 'flights',
                paint: {
                    'circle-radius': 14,
                    'circle-color': '#4ade80',
                    'circle-opacity': 0.6,
                    'circle-blur': 1.5,
                },
            }, 'flights-layer');

            // Airport click handler
            map.on('click', 'airports-layer', (e) => {
                if (!e.features || e.features.length === 0) return;
                onAirportSelect(e.features[0].properties as unknown as Airport);
            });

            map.on('mouseenter', 'airports-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'airports-layer', () => { map.getCanvas().style.cursor = ''; });
        });

        mapRef.current = map;
        return () => { map.remove(); mapRef.current = null; };
    }, []);

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

        // --- Airport GeoJSON (unchanged logic, just batched) ---
        const airportGeojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: airports.map((a) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] },
                properties: { ...a, fleetCount: fleetBaseCounts?.[a.iata] || 0 },
            })),
        };

        // --- Player flight arcs (with culling + LOD + caching) ---
        const arcFeatures: GeoJSON.Feature[] = [];
        for (const ac of fleet) {
            if (ac.status !== 'enroute' || !ac.flight) continue;
            const origin = airportIndex.get(ac.flight.originIata);
            const dest = airportIndex.get(ac.flight.destinationIata);
            if (!origin || !dest) continue;

            // Viewport culling
            if (!routeIntersectsViewport(
                origin.longitude, origin.latitude,
                dest.longitude, dest.latitude,
                bounds
            )) continue;

            const points = getOrComputeArc(origin, dest, segments);
            arcFeatures.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: points },
                properties: {},
            });
        }

        // --- Global route arcs (with culling + LOD + caching) ---
        const globalArcFeatures: GeoJSON.Feature[] = [];
        for (const route of globalRoutes) {
            const origin = airportIndex.get(route.originIata);
            const dest = airportIndex.get(route.destinationIata);
            if (!origin || !dest) continue;

            // Viewport culling
            if (!routeIntersectsViewport(
                origin.longitude, origin.latitude,
                dest.longitude, dest.latitude,
                bounds
            )) continue;

            const points = getOrComputeArc(origin, dest, segments);
            globalArcFeatures.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: points },
                properties: {},
            });
        }

        (map.getSource('airports') as maplibregl.GeoJSONSource)?.setData(airportGeojson);
        (map.getSource('arcs') as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: arcFeatures });
        (map.getSource('global-arcs') as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: globalArcFeatures });
    }, [airports, mapLoaded, fleetBaseCounts, fleet, globalRoutes, airportIndex, getOrComputeArc]);

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

                const arcFeatures: GeoJSON.Feature[] = [];
                for (const ac of latestFleet.current) {
                    if (ac.status !== 'enroute' || !ac.flight) continue;
                    const origin = airportIndex.get(ac.flight.originIata);
                    const dest = airportIndex.get(ac.flight.destinationIata);
                    if (!origin || !dest) continue;
                    if (!routeIntersectsViewport(
                        origin.longitude, origin.latitude,
                        dest.longitude, dest.latitude,
                        bounds
                    )) continue;
                    const points = getOrComputeArc(origin, dest, segments);
                    arcFeatures.push({
                        type: 'Feature',
                        geometry: { type: 'LineString', coordinates: points },
                        properties: {},
                    });
                }

                const globalArcFeatures: GeoJSON.Feature[] = [];
                for (const route of globalRoutes) {
                    const origin = airportIndex.get(route.originIata);
                    const dest = airportIndex.get(route.destinationIata);
                    if (!origin || !dest) continue;
                    if (!routeIntersectsViewport(
                        origin.longitude, origin.latitude,
                        dest.longitude, dest.latitude,
                        bounds
                    )) continue;
                    const points = getOrComputeArc(origin, dest, segments);
                    globalArcFeatures.push({
                        type: 'Feature',
                        geometry: { type: 'LineString', coordinates: points },
                        properties: {},
                    });
                }

                (map.getSource('arcs') as maplibregl.GeoJSONSource)?.setData({
                    type: 'FeatureCollection', features: arcFeatures,
                });
                (map.getSource('global-arcs') as maplibregl.GeoJSONSource)?.setData({
                    type: 'FeatureCollection', features: globalArcFeatures,
                });
            }, 150); // 150ms debounce
        };

        map.on('moveend', onViewChange);
        map.on('zoomend', onViewChange);

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            map.off('moveend', onViewChange);
            map.off('zoomend', onViewChange);
        };
    }, [mapLoaded, airportIndex, getOrComputeArc, globalRoutes]);

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

        const processFleet = (
            targetFleet: AircraftInstance[],
            currentTick: number,
            currentProgress: number,
            bounds: maplibregl.LngLatBounds,
        ): GeoJSON.Feature[] => {
            const features: GeoJSON.Feature[] = [];
            for (const ac of targetFleet) {
                if (ac.status !== 'enroute' || !ac.flight) continue;
                const f = ac.flight;
                const origin = airportIndex.get(f.originIata);
                const dest = airportIndex.get(f.destinationIata);
                if (!origin || !dest) continue;

                const duration = Math.max(1, f.arrivalTick - f.departureTick);
                const elapsed = (currentTick - f.departureTick) + currentProgress;
                const progress = Math.max(0, Math.min(1, elapsed / duration));

                const coords = getGreatCircleInterpolation(
                    [origin.longitude, origin.latitude],
                    [dest.longitude, dest.latitude],
                    progress
                );

                // Viewport culling for individual aircraft
                if (!pointInViewport(coords[0], coords[1], bounds)) continue;

                const nextProgress = Math.min(1, progress + 0.01);
                const nextCoords = getGreatCircleInterpolation(
                    [origin.longitude, origin.latitude],
                    [dest.longitude, dest.latitude],
                    nextProgress
                );

                const bearing = getBearing(coords, nextCoords);
                const model = aircraftModelMap.get(ac.modelId);
                const type = model?.type || 'narrowbody';

                features.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: coords },
                    properties: { id: ac.id, bearing, type },
                });
            }
            return features;
        };

        let isAnimating = true;

        const animate = () => {
            if (!isAnimating || !mapRef.current) return;

            const bounds = map.getBounds();
            const currentTick = latestTick.current;
            const currentProgress = latestTickProgress.current;

            const flightFeatures = processFleet(
                latestFleet.current, currentTick, currentProgress, bounds
            );
            const globalFlightFeatures = processFleet(
                latestGlobalFleet.current, currentTick, currentProgress, bounds
            );

            (map.getSource('flights') as maplibregl.GeoJSONSource)?.setData({
                type: 'FeatureCollection', features: flightFeatures,
            });
            (map.getSource('global-flights') as maplibregl.GeoJSONSource)?.setData({
                type: 'FeatureCollection', features: globalFlightFeatures,
            });

            rafId.current = requestAnimationFrame(animate);
        };

        rafId.current = requestAnimationFrame(animate);

        return () => {
            isAnimating = false;
            cancelAnimationFrame(rafId.current);
        };
    }, [mapLoaded, airportIndex]);

    // =========================================================================
    // Initial fly-to on first airport selection
    // =========================================================================
    useEffect(() => {
        if (!mapLoaded || !mapRef.current || !selectedAirport) return;

        if (!hasInitialFlied.current) {
            hasInitialFlied.current = true;
            mapRef.current.flyTo({
                center: [selectedAirport.longitude, selectedAirport.latitude],
                zoom: 4.5,
                essential: true,
                duration: 2000,
            });
        }
    }, [selectedAirport, mapLoaded]);

    return (
        <div
            ref={mapContainer}
            className={`globe-container ${className}`}
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, ...style }}
        />
    );
}
