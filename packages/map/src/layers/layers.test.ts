import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DARK_MAP_PALETTE, EARTH_MAP_PALETTE } from "../theme.js";
import { addAirportLayers, buildPresenceBadge } from "./airports.js";
import { addFlightLayers, registerAircraftIcons } from "./flights.js";
import {
  ATMOSPHERE_FADE_END_ZOOM,
  applyGlobeView,
  GLOBE_DIAMETER_AT_ZOOM_0,
  globeFitZoom,
  globeSky,
} from "./globeView.js";
import {
  addNightOverlay,
  NIGHT_CANVAS_H,
  NIGHT_CANVAS_LAYER,
  NIGHT_CANVAS_SOURCE,
  NIGHT_CANVAS_W,
  paintNightCanvas,
} from "./nightOverlay.js";
import { addRouteLayers } from "./routes.js";
import { addDataSources } from "./sources.js";

// A stand-in for maplibregl.Map that records what the layer modules add.
function fakeMap() {
  const layers: Array<{ id: string; before?: string; spec: Record<string, unknown> }> = [];
  const sources: Array<{ id: string; spec: Record<string, unknown> }> = [];
  const images = new Map<string, unknown>();
  const map = {
    addLayer: (spec: Record<string, unknown>, before?: string) =>
      layers.push({ id: spec.id as string, before, spec }),
    addSource: (id: string, spec: Record<string, unknown>) => sources.push({ id, spec }),
    hasImage: (id: string) => images.has(id),
    addImage: (id: string, image: unknown) => images.set(id, image),
  };
  return { map: map as never, layers, sources, images };
}

// Minimal 2D canvas: records arcs drawn and the last image written.
function fakeCanvas() {
  const ctx = {
    lineWidth: 0,
    strokeStyle: "",
    arcs: [] as string[],
    written: null as { data: Uint8ClampedArray } | null,
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(image: { data: Uint8ClampedArray }) {
      this.written = image;
    },
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h }),
    beginPath: () => {},
    arc() {
      ctx.arcs.push(ctx.strokeStyle);
    },
    stroke: () => {},
  };
  return { width: 0, height: 0, getContext: () => ctx, ctx };
}

beforeEach(() => {
  vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  vi.stubGlobal(
    "ImageData",
    class {
      constructor(
        public width: number,
        public height: number,
      ) {}
    },
  );
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("map layer modules", () => {
  it("adds the layers in the same stacking order as before the split", () => {
    const { map, layers, sources } = fakeMap();
    addNightOverlay(map, DARK_MAP_PALETTE.nightTint);
    addDataSources(map);
    addRouteLayers(map, DARK_MAP_PALETTE);
    addAirportLayers(map, DARK_MAP_PALETTE);
    addFlightLayers(map, DARK_MAP_PALETTE);

    expect(sources.map((s) => s.id)).toEqual([
      NIGHT_CANVAS_SOURCE,
      "flights",
      "arcs",
      "global-flights",
      "global-arcs",
      "airports",
    ]);
    expect(layers.map((l) => l.id)).toEqual([
      NIGHT_CANVAS_LAYER,
      "global-arcs-layer",
      "arcs-layer",
      "active-hub-glow",
      "airports-layer",
      "ground-presence-layer",
      "global-flights-layer",
      "global-flights-accent-layer",
      "flights-layer",
      "flights-accent-layer",
      "flight-glow",
      "global-flight-light-port",
      "global-flight-light-stbd",
      "global-flight-light-strobe",
      "flight-light-port",
      "flight-light-stbd",
      "flight-light-strobe",
    ]);
    // The glow sits under the player's aircraft.
    expect(layers.find((l) => l.id === "flight-glow")?.before).toBe("flights-layer");
  });

  it("draws with the theme's palette", () => {
    const { map, layers } = fakeMap();
    addRouteLayers(map, EARTH_MAP_PALETTE);
    const paint = layers[0].spec.paint as Record<string, unknown>;
    expect(paint["line-color"]).toBe(EARTH_MAP_PALETTE.routes.global);
  });

  it("registers every aircraft family icon once", () => {
    const { map, images } = fakeMap();
    registerAircraftIcons(map);
    registerAircraftIcons(map);
    expect(images.has("airplane-a320")).toBe(true);
    expect(images.has("airplane-a320-accent")).toBe(true);
    expect(images.has("airplane-icon")).toBe(true);
    expect(images.has("light-dot")).toBe(true);
  });
});

describe("night overlay", () => {
  it("returns a full-size canvas painted for the current sun", () => {
    const { map } = fakeMap();
    const canvas = addNightOverlay(map, DARK_MAP_PALETTE.nightTint) as unknown as ReturnType<
      typeof fakeCanvas
    >;
    expect(canvas.width).toBe(NIGHT_CANVAS_W);
    expect(canvas.height).toBe(NIGHT_CANVAS_H);
    expect(canvas.ctx.written).not.toBeNull();
  });

  it("leaves the sunlit side clear and darkens the far side", () => {
    const canvas = fakeCanvas();
    canvas.width = NIGHT_CANVAS_W;
    canvas.height = NIGHT_CANVAS_H;
    const tint = { r: 1, g: 2, b: 3, maxAlpha: 0.5 };
    // Sun over (0°, 0°): column W/2 is longitude 0°, column 0 is 180°W.
    paintNightCanvas(canvas as never, 0, 0, tint);
    const data = canvas.ctx.written?.data as Uint8ClampedArray;
    const alphaAt = (x: number, y: number) => data[(y * NIGHT_CANVAS_W + x) * 4 + 3];
    const equator = NIGHT_CANVAS_H / 2;
    expect(data[0]).toBe(1);
    expect(alphaAt(NIGHT_CANVAS_W / 2, equator)).toBe(0); // noon
    expect(alphaAt(0, equator)).toBe(Math.round(0.5 * 255)); // midnight
  });

  it("does nothing without a 2D context", () => {
    expect(() =>
      paintNightCanvas({ getContext: () => null } as never, 0, 0, DARK_MAP_PALETTE.nightTint),
    ).not.toThrow();
  });
});

describe("buildPresenceBadge", () => {
  it("draws one arc per airline with aircraft on the ground", () => {
    const image = buildPresenceBadge(
      [
        { color: "#f00", count: 2 },
        { color: "#0f0", count: 0 },
        { color: "#00f", count: 1 },
      ],
      32,
    );
    expect(image).toMatchObject({ width: 32, height: 32 });
  });

  it("returns a blank badge when nothing is on the ground or there is no context", () => {
    expect(buildPresenceBadge([], 16)).toMatchObject({ width: 16, height: 16 });
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
    expect(buildPresenceBadge([{ color: "#f00", count: 1 }], 16)).toMatchObject({ width: 16 });
  });
});

describe("globe view", () => {
  it("uses the theme's sky colours and fades the atmosphere as you zoom in", () => {
    const sky = globeSky(EARTH_MAP_PALETTE);
    expect(sky["sky-color"]).toBe(EARTH_MAP_PALETTE.sky.space);
    expect(sky["horizon-color"]).toBe(EARTH_MAP_PALETTE.sky.horizon);
    expect(sky["fog-color"]).toBe(EARTH_MAP_PALETTE.sky.fog);
    const blend = sky["atmosphere-blend"] as unknown[];
    expect(blend.slice(-2)).toEqual([ATMOSPHERE_FADE_END_ZOOM, 0]);
  });

  it("switches the map to the globe projection with the sky", () => {
    const calls: unknown[][] = [];
    const map = {
      setProjection: (projection: unknown) => calls.push(["projection", projection]),
      setSky: (sky: unknown) => calls.push(["sky", sky]),
    };
    applyGlobeView(map as never, DARK_MAP_PALETTE);
    expect(calls).toEqual([
      ["projection", { type: "globe" }],
      ["sky", globeSky(DARK_MAP_PALETTE)],
    ]);
  });
});

describe("globeFitZoom", () => {
  it("fits the whole planet in the viewport's shorter side", () => {
    const zoom = globeFitZoom(390, 844);
    expect(GLOBE_DIAMETER_AT_ZOOM_0 * 2 ** zoom).toBeCloseTo(0.85 * 390, -1);
    expect(globeFitZoom(1440, 900)).toBeGreaterThan(zoom);
  });

  it("stays within sensible bounds", () => {
    expect(globeFitZoom(8000, 8000)).toBe(1.5);
    expect(globeFitZoom(10, 10)).toBe(-1);
    expect(globeFitZoom(0, 0)).toBe(1.5);
  });
});
