import type * as maplibregl from "maplibre-gl";
import { FAMILY_ICONS, LIGHT_DOT_SVG, WING_TIP_OFFSETS } from "../icons.js";
import {
  alphaToSdf,
  ICON_PIXEL_RATIO,
  resizeSvg,
  sdfIconDimensions,
  sdfImage,
  svgLogicalSize,
} from "../sdf.js";
import type { MapPalette } from "../theme.js";
import { buildContrailImage, TRAIL_MIN_ZOOM, TRAIL_TAIL_OFFSET } from "../trail.js";

/**
 * Registers the per-family aircraft icons and the navigation-light dot as
 * SDF images. Each SVG is rasterised at ICON_PIXEL_RATIO with a transparent
 * buffer and converted to a real distance field (see sdf.ts), so icons stay
 * crisp when zoomed and can be tinted and outlined at runtime.
 */
export function registerAircraftIcons(map: maplibregl.Map): void {
  const addIcon = (id: string, svg: string) => {
    const { inner, buffer, size } = sdfIconDimensions(svgLogicalSize(svg));
    const img = new Image();
    img.onload = () => {
      if (map.hasImage(id)) return;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, buffer, buffer, inner, inner);
      const { data } = ctx.getImageData(0, 0, size, size);
      const alpha = new Uint8ClampedArray(size * size);
      for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
      map.addImage(id, sdfImage(alphaToSdf(alpha, size, size), size, size), {
        sdf: true,
        pixelRatio: ICON_PIXEL_RATIO,
      });
    };
    img.src = "data:image/svg+xml;base64," + btoa(resizeSvg(svg, inner));
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

  // Contrail: a plain (non-SDF) white gradient, drawn behind moving aircraft.
  if (!map.hasImage("contrail")) {
    map.addImage("contrail", buildContrailImage(ICON_PIXEL_RATIO), {
      pixelRatio: ICON_PIXEL_RATIO,
    });
  }
}

/**
 * Aircraft icon size: wingspan-relative (`sizeScale`) and growing with zoom,
 * with a floor at low zooms so a turboprop stays a readable silhouette
 * instead of a dot. `factor` scales every stop (used for the halo width).
 */
function iconSizeExpression(factor = 1): maplibregl.ExpressionSpecification {
  const stop = (scale: number, floor?: number): maplibregl.ExpressionSpecification => {
    const size: maplibregl.ExpressionSpecification = ["*", ["get", "sizeScale"], scale];
    const floored: maplibregl.ExpressionSpecification =
      floor === undefined ? size : ["max", size, floor];
    return factor === 1 ? floored : ["*", floored, factor];
  };
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    stop(0.15, 0.3),
    5,
    stop(0.4, 0.42),
    8,
    stop(0.7),
    12,
    stop(1),
  ];
}

/**
 * Shared by the body, accent and navigation-light layers so wing-tip lights
 * stay aligned with the aircraft.
 */
export const AIRCRAFT_ICON_SIZE = iconSizeExpression();

/**
 * Outline around the player's aircraft, in px per unit of icon size. Scaling
 * it with the icon keeps it inside the distance field's range at every zoom
 * (a fixed width overflows small icons and fills their whole square).
 */
export const PLAYER_HALO_PER_ICON_SIZE = 2.6;

/** Trail opacity for the player's aircraft and for rivals'. */
export const TRAIL_OPACITY = { player: 0.4, rivals: 0.22 } as const;

/**
 * A contrail behind each aircraft of `sourceId`: same size expression and
 * bearing as the aircraft, anchored at the tail. Fades in above TRAIL_MIN_ZOOM.
 */
function addTrailLayer(map: maplibregl.Map, id: string, sourceId: string, opacity: number) {
  map.addLayer({
    id,
    type: "symbol",
    source: sourceId,
    minzoom: TRAIL_MIN_ZOOM,
    layout: {
      "icon-image": "contrail",
      "icon-size": AIRCRAFT_ICON_SIZE,
      "icon-rotate": ["get", "bearing"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "top",
      "icon-offset": [0, TRAIL_TAIL_OFFSET],
    },
    paint: {
      "icon-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        TRAIL_MIN_ZOOM,
        0,
        TRAIL_MIN_ZOOM + 1,
        opacity,
      ],
    },
  });
}

/** Aircraft layers: rivals' and the player's flights (body + livery accent), glow and navigation lights. */
export function addFlightLayers(map: maplibregl.Map, mapThemePalette: MapPalette): void {
  addTrailLayer(map, "global-flight-trail", "global-flights", TRAIL_OPACITY.rivals);

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
      "icon-size": AIRCRAFT_ICON_SIZE,
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
      "icon-size": AIRCRAFT_ICON_SIZE,
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

  addTrailLayer(map, "flight-trail", "flights", TRAIL_OPACITY.player);

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
      "icon-size": AIRCRAFT_ICON_SIZE,
      "icon-rotate": ["get", "bearing"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
    },
    paint: {
      "icon-color": ["coalesce", ["get", "primaryColor"], "#ffffff"],
      // Your aircraft carry an outline (rivals' don't), so your fleet reads at
      // a glance even when a rival flies a similar livery colour.
      "icon-halo-color": mapThemePalette.flights.playerHalo,
      "icon-halo-width": iconSizeExpression(PLAYER_HALO_PER_ICON_SIZE),
      "icon-halo-blur": 0.2,
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
      "icon-size": AIRCRAFT_ICON_SIZE,
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
  const lightIconSizeExpr = AIRCRAFT_ICON_SIZE;
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
