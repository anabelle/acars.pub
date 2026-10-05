import type * as maplibregl from "maplibre-gl";

/** Empty GeoJSON sources the map's data layers draw from; effects fill them. */
export function addDataSources(map: maplibregl.Map): void {
  map.addSource("flights", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("arcs", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("global-flights", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("global-arcs", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("airports", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
}
