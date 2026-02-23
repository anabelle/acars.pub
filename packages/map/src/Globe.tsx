import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Airport } from '@airtr/core';

export interface GlobeProps {
    airports: Airport[];
    selectedAirport: Airport | null;
    onAirportSelect: (airport: Airport | null) => void;
    fleetBaseCounts?: Record<string, number>;
    className?: string;
    style?: React.CSSProperties;
}

export function Globe({ airports, selectedAirport, onAirportSelect, fleetBaseCounts, className = '', style }: GlobeProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        // Dark base map from Carto (voyager, positron, dark_matter)
        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [0, 20],
            zoom: 1.5,
            pitch: 0,
        });

        // Disable double click zoom for better selection UX
        map.doubleClickZoom.disable();

        map.on('load', () => {
            setMapLoaded(true);

            // Add a source for all airports
            map.addSource('airports', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [], // Data injected via effect later
                },
            });

            // Add circle layer for airports
            map.addLayer({
                id: 'airports-layer',
                type: 'circle',
                source: 'airports',
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        1, 1.5,
                        6, 4,
                        10, 8
                    ],
                    'circle-color': '#e94560',
                    'circle-opacity': 0.8,
                    'circle-stroke-width': 0.5,
                    'circle-stroke-color': '#fff'
                },
            });

            // Add fleet parked icons layer
            map.addLayer({
                id: 'fleet-layer',
                type: 'symbol',
                source: 'airports',
                filter: ['>', ['get', 'fleetCount'], 0],
                layout: {
                    'text-field': '✈️ {fleetCount}',
                    'text-size': 14,
                    'text-anchor': 'bottom',
                    'text-offset': [0, -0.5],
                    'text-allow-overlap': true
                },
                paint: {
                    'text-halo-color': '#000000',
                    'text-halo-width': 2,
                    'text-color': '#4ade80'
                }
            });

            // Add interaction
            map.on('click', 'airports-layer', (e) => {
                if (!e.features || e.features.length === 0) return;
                const feature = e.features[0];
                // Ensure proper prop type from feature properties
                const id = feature.properties?.id;
                if (id) {
                    // Callback invoked with IATA -> actually, our feature should keep the full property payload
                    onAirportSelect(feature.properties as unknown as Airport);
                }
            });

            // Change cursor on hover
            map.on('mouseenter', 'airports-layer', () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'airports-layer', () => {
                map.getCanvas().style.cursor = '';
            });
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Sync airport data into MapLibre
    useEffect(() => {
        if (!mapLoaded || !mapRef.current) return;
        const map = mapRef.current;

        const geojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: airports.map((a) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] },
                properties: {
                    ...a,
                    fleetCount: fleetBaseCounts?.[a.iata] || 0
                }, // Spread all properties so select works
            })),
        };

        const source = map.getSource('airports') as maplibregl.GeoJSONSource;
        if (source) {
            source.setData(geojson);
        }
    }, [airports, mapLoaded, fleetBaseCounts]);

    // Sync selection
    useEffect(() => {
        if (!mapLoaded || !mapRef.current) return;
        // Potentially draw a highlight or fly to
        // Not implementing fly-to here to avoid forced camera hijack, just an example
    }, [selectedAirport, mapLoaded]);

    return (
        <div
            ref={mapContainer}
            className={`globe-container ${className}`}
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, ...style }}
        />
    );
}
