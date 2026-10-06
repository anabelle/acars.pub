import type * as maplibregl from "maplibre-gl";
import { FAMILY_ICONS, LIGHT_DOT_SVG, WING_TIP_OFFSETS } from "../icons.js";
import type { MapPalette } from "../theme.js";

/** Registers the per-family aircraft icons and the navigation-light dot as SDF images. */
export function registerAircraftIcons(map: maplibregl.Map): void {
  // Helper to add SVG to map as SDF
  const addIcon = (id: string, svg: string) => {
    const img = new Image();
    img.onload = () => {
      if (!map.hasImage(id)) {
        map.addImage(id, img, { sdf: true });
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(svg);
  };

  // Register per-family icons (12 families × 2 layers = 24 icons)
  for (const [familyId, svgs] of Object.entries(FAMILY_ICONS)) {
    addIcon(`airplane-${familyId}`, svgs.body);
    addIcon(`airplane-${familyId}-accent`, svgs.accent);
  }
  // Backward-compatible fallback alias
  addIcon("airplane-icon", FAMILY_ICONS["a320"].body);
  addIcon("airplane-icon-accent", FAMILY_ICONS["a320"].accent);

  // Register navigation light icon (single SDF circle, positioned via icon-offset)
  addIcon("light-dot", LIGHT_DOT_SVG);
}

/** Aircraft layers: rivals' and the player's flights (body + livery accent), glow and navigation lights. */
export function addFlightLayers(map: maplibregl.Map, mapThemePalette: MapPalette): void {
  // Layer: Global Flights (body — primary color)
  map.addLayer({
    id: "global-flights-layer",
    type: "symbol",
    source: "global-flights",
    layout: {
      "icon-image": [
        "match",
        ["get", "familyId"],
        "atr",
        "airplane-atr",
        "dash8",
        "airplane-dash8",
        "a220",
        "airplane-a220",
        "ejet",
        "airplane-ejet",
        "a320",
        "airplane-a320",
        "b737",
        "airplane-b737",
        "a330",
        "airplane-a330",
        "b787",
        "airplane-b787",
        "b777",
        "airplane-b777",
        "a350",
        "airplane-a350",
        "a380",
        "airplane-a380",
        "b747",
        "airplane-b747",
        "airplane-a320",
      ],
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        2,
        ["*", ["get", "sizeScale"], 0.15],
        5,
        ["*", ["get", "sizeScale"], 0.4],
        8,
        ["*", ["get", "sizeScale"], 0.7],
        12,
        ["*", ["get", "sizeScale"], 1.0],
      ],
      "icon-rotate": ["get", "bearing"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
    },
    paint: {
      "icon-color": ["coalesce", ["get", "primaryColor"], "#64748b"],
      "icon-opacity": 0.8,
    },
  });

  // Layer: Global Flights (accent — secondary color)
  map.addLayer({
    id: "global-flights-accent-layer",
    type: "symbol",
    source: "global-flights",
    layout: {
      "icon-image": [
        "match",
        ["get", "familyId"],
        "atr",
        "airplane-atr-accent",
        "dash8",
        "airplane-dash8-accent",
        "a220",
        "airplane-a220-accent",
        "ejet",
        "airplane-ejet-accent",
        "a320",
        "airplane-a320-accent",
        "b737",
        "airplane-b737-accent",
        "a330",
        "airplane-a330-accent",
        "b787",
        "airplane-b787-accent",
        "b777",
        "airplane-b777-accent",
        "a350",
        "airplane-a350-accent",
        "a380",
        "airplane-a380-accent",
        "b747",
        "airplane-b747-accent",
        "airplane-a320-accent",
      ],
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        2,
        ["*", ["get", "sizeScale"], 0.15],
        5,
        ["*", ["get", "sizeScale"], 0.4],
        8,
        ["*", ["get", "sizeScale"], 0.7],
        12,
        ["*", ["get", "sizeScale"], 1.0],
      ],
      "icon-rotate": ["get", "bearing"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
    },
    paint: {
      "icon-color": ["coalesce", ["get", "secondaryColor"], "#94a3b8"],
      "icon-opacity": 0.8,
    },
  });

  // Layer: Active Flights — body (primary color)
  map.addLayer({
    id: "flights-layer",
    type: "symbol",
    source: "flights",
    layout: {
      "icon-image": [
        "match",
        ["get", "familyId"],
        "atr",
        "airplane-atr",
        "dash8",
        "airplane-dash8",
        "a220",
        "airplane-a220",
        "ejet",
        "airplane-ejet",
        "a320",
        "airplane-a320",
        "b737",
        "airplane-b737",
        "a330",
        "airplane-a330",
        "b787",
        "airplane-b787",
        "b777",
        "airplane-b777",
        "a350",
        "airplane-a350",
        "a380",
        "airplane-a380",
        "b747",
        "airplane-b747",
        "airplane-a320",
      ],
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        2,
        ["*", ["get", "sizeScale"], 0.15],
        5,
        ["*", ["get", "sizeScale"], 0.4],
        8,
        ["*", ["get", "sizeScale"], 0.7],
        12,
        ["*", ["get", "sizeScale"], 1.0],
      ],
      "icon-rotate": ["get", "bearing"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
    },
    paint: {
      "icon-color": ["coalesce", ["get", "primaryColor"], "#ffffff"],
    },
  });

  // Layer: Active Flights — accent (secondary color)
  map.addLayer({
    id: "flights-accent-layer",
    type: "symbol",
    source: "flights",
    layout: {
      "icon-image": [
        "match",
        ["get", "familyId"],
        "atr",
        "airplane-atr-accent",
        "dash8",
        "airplane-dash8-accent",
        "a220",
        "airplane-a220-accent",
        "ejet",
        "airplane-ejet-accent",
        "a320",
        "airplane-a320-accent",
        "b737",
        "airplane-b737-accent",
        "a330",
        "airplane-a330-accent",
        "b787",
        "airplane-b787-accent",
        "b777",
        "airplane-b777-accent",
        "a350",
        "airplane-a350-accent",
        "a380",
        "airplane-a380-accent",
        "b747",
        "airplane-b747-accent",
        "airplane-a320-accent",
      ],
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        2,
        ["*", ["get", "sizeScale"], 0.15],
        5,
        ["*", ["get", "sizeScale"], 0.4],
        8,
        ["*", ["get", "sizeScale"], 0.7],
        12,
        ["*", ["get", "sizeScale"], 1.0],
      ],
      "icon-rotate": ["get", "bearing"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
    },
    paint: {
      "icon-color": ["coalesce", ["get", "secondaryColor"], "#cbd5e1"],
    },
  });

  // Layer: Flight glow
  map.addLayer(
    {
      id: "flight-glow",
      type: "circle",
      source: "flights",
      paint: {
        "circle-radius": 14,
        "circle-color": [
          "coalesce",
          ["get", "secondaryColor"],
          mapThemePalette.flights.fallbackAccent,
        ],
        "circle-opacity": 0.25,
        "circle-blur": 1.5,
      },
    },
    "flights-layer",
  );

  // Navigation light layers (port/starboard/strobe for each flight source)
  // Build per-family icon-offset match expressions from WING_TIP_OFFSETS
  const portOffsetExpr = [
    "match",
    ["get", "familyId"],
    ...Object.entries(WING_TIP_OFFSETS).flatMap(([fam, [px, py]]) => [fam, ["literal", [px, py]]]),
    ["literal", [-20, 3]],
  ] as unknown as maplibregl.ExpressionSpecification;
  const stbdOffsetExpr = [
    "match",
    ["get", "familyId"],
    ...Object.entries(WING_TIP_OFFSETS).flatMap(([fam, [px, py]]) => [fam, ["literal", [-px, py]]]),
    ["literal", [20, 3]],
  ] as unknown as maplibregl.ExpressionSpecification;
  // Keep icon-size scaling identical to aircraft icons so wing-tip offsets
  // remain aligned per family and wingspan across zoom levels.
  const lightIconSizeExpr: maplibregl.ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    ["*", ["get", "sizeScale"], 0.15],
    5,
    ["*", ["get", "sizeScale"], 0.4],
    8,
    ["*", ["get", "sizeScale"], 0.7],
    12,
    ["*", ["get", "sizeScale"], 1.0],
  ];
  const addLightLayers = (sourceId: string, prefix: string, baseOpacity: number) => {
    const sharedLayout: maplibregl.SymbolLayerSpecification["layout"] = {
      "icon-image": "light-dot",
      "icon-rotate": ["get", "bearing"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
      "icon-size": lightIconSizeExpr,
    };
    // Port light (red, steady)
    map.addLayer({
      id: `${prefix}-light-port`,
      type: "symbol",
      source: sourceId,
      minzoom: 4,
      layout: {
        ...sharedLayout,
        "icon-offset": portOffsetExpr,
      },
      paint: {
        "icon-color": "#ff0000",
        "icon-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0, 5, baseOpacity],
        "icon-halo-color": "#ff0000",
        "icon-halo-width": 0.4,
        "icon-halo-blur": 0.2,
      },
    });
    // Starboard light (green, steady)
    map.addLayer({
      id: `${prefix}-light-stbd`,
      type: "symbol",
      source: sourceId,
      minzoom: 4,
      layout: {
        ...sharedLayout,
        "icon-offset": stbdOffsetExpr,
      },
      paint: {
        "icon-color": "#00ff00",
        "icon-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0, 5, baseOpacity],
        "icon-halo-color": "#00ff00",
        "icon-halo-width": 0.4,
        "icon-halo-blur": 0.2,
      },
    });
    // Strobe light — offset symbol pulse so white flash is not hidden by fuselage.
    const strobeIconSizeExpr: maplibregl.ExpressionSpecification = [
      "interpolate",
      ["linear"],
      ["zoom"],
      2,
      ["*", ["get", "sizeScale"], 0.22],
      5,
      ["*", ["get", "sizeScale"], 0.55],
      8,
      ["*", ["get", "sizeScale"], 0.9],
      12,
      ["*", ["get", "sizeScale"], 1.25],
    ];
    map.addLayer({
      id: `${prefix}-light-strobe`,
      type: "symbol",
      source: sourceId,
      minzoom: 4,
      layout: {
        ...sharedLayout,
        "icon-size": strobeIconSizeExpr,
        "icon-offset": [0, 8],
      },
      paint: {
        "icon-color": "#ffffff",
        // zoom must be the top-level expression input — cannot be nested
        // inside arithmetic. Use step+case: fade in at zoom 5, then
        // gate the opacity on the per-feature strobeOn flag.
        "icon-opacity": [
          "step",
          ["zoom"],
          0, // below minzoom 4 → always 0
          4,
          ["case", ["==", ["get", "strobeOn"], 1], 0, 0],
          5,
          ["case", ["==", ["get", "strobeOn"], 1], baseOpacity, 0],
        ],
        "icon-halo-color": "#ffffff",
        "icon-halo-width": [
          "step",
          ["zoom"],
          0,
          4,
          ["case", ["==", ["get", "strobeOn"], 1], 0.8, 0],
          5,
          ["case", ["==", ["get", "strobeOn"], 1], 1.8, 0],
        ],
        "icon-halo-blur": ["case", ["==", ["get", "strobeOn"], 1], 0.8, 0],
      },
    });
  };
  addLightLayers("global-flights", "global-flight", 0.6);
  addLightLayers("flights", "flight", 0.9);
}
