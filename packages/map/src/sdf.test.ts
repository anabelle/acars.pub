import { describe, expect, it } from "vitest";
import { FAMILY_ICONS, LIGHT_DOT_SVG } from "./icons.js";
import {
  alphaToSdf,
  ICON_BUFFER,
  ICON_LOGICAL_SIZE,
  ICON_PIXEL_RATIO,
  resizeSvg,
  SDF_CUTOFF,
  SDF_RADIUS,
  sdfIconDimensions,
  sdfImage,
  svgLogicalSize,
} from "./sdf.js";

/** A width × height mask with a filled axis-aligned rectangle. */
function rectMask(width: number, height: number, x0: number, y0: number, x1: number, y1: number) {
  const mask = new Uint8ClampedArray(width * height);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * width + x] = 255;
  return mask;
}

const EDGE = Math.round(255 * (1 - SDF_CUTOFF));

describe("alphaToSdf()", () => {
  const W = 40;
  const sdf = alphaToSdf(rectMask(W, W, 10, 10, 30, 30), W, W);
  const at = (x: number, y: number) => sdf[y * W + x];

  it("is high inside, near the edge value on the boundary, zero far outside", () => {
    expect(at(20, 20)).toBe(255);
    // Distances run pixel centre to centre: the boundary pixels on either side
    // are 1 px from the other region, so the edge value falls midway.
    const step = 255 / SDF_RADIUS;
    expect(at(10, 20)).toBe(Math.round(EDGE + step));
    expect(at(9, 20)).toBe(Math.round(EDGE - step));
    expect(at(0, 0)).toBe(0);
  });

  it("falls off linearly with distance outside the shape", () => {
    const step = 255 / SDF_RADIUS;
    for (let d = 1; d < 5; d++) {
      expect(Math.abs(at(9 - d, 20) - at(10 - d, 20) + step)).toBeLessThanOrEqual(1);
    }
  });

  it("measures true Euclidean distance at corners", () => {
    // (6, 6) is 4·√2 ≈ 5.66 px diagonally from the corner pixel (10, 10).
    const expected = Math.round(255 - 255 * (Math.hypot(4, 4) / SDF_RADIUS + SDF_CUTOFF));
    expect(at(6, 6)).toBe(expected);
  });

  it("places anti-aliased pixels between inside and outside", () => {
    const mask = rectMask(W, W, 10, 10, 30, 30);
    for (let y = 10; y < 30; y++) mask[y * W + 30] = 128; // half-covered column
    const soft = alphaToSdf(mask, W, W);
    const v = soft[20 * W + 30];
    expect(v).toBeGreaterThan(sdf[20 * W + 30]);
    expect(v).toBeLessThan(sdf[20 * W + 29]);
  });

  it("handles an empty mask", () => {
    expect([...alphaToSdf(new Uint8ClampedArray(9), 3, 3)]).toEqual(Array(9).fill(0));
  });
});

describe("icon sizing helpers", () => {
  it("buffers icons at the device pixel ratio", () => {
    expect(sdfIconDimensions(ICON_LOGICAL_SIZE)).toEqual({
      inner: ICON_LOGICAL_SIZE * ICON_PIXEL_RATIO,
      buffer: ICON_BUFFER * ICON_PIXEL_RATIO,
      size: (ICON_LOGICAL_SIZE + 2 * ICON_BUFFER) * ICON_PIXEL_RATIO,
    });
  });

  it("reads and rewrites the root size of every icon SVG", () => {
    const svgs = [LIGHT_DOT_SVG, ...Object.values(FAMILY_ICONS).flatMap((i) => [i.body, i.accent])];
    for (const svg of svgs) {
      const size = svgLogicalSize(svg);
      const resized = resizeSvg(svg, size * 2);
      expect(svgLogicalSize(resized)).toBe(size * 2);
      expect(resized).toContain(`height="${size * 2}"`);
      // Only the root element changes.
      expect(resized.replace(/<svg[^>]*>/, "")).toBe(svg.replace(/<svg[^>]*>/, ""));
    }
    expect(svgLogicalSize(LIGHT_DOT_SVG)).toBe(12);
    expect(svgLogicalSize("<svg></svg>")).toBe(ICON_LOGICAL_SIZE);
  });

  it("wraps a field as white RGBA", () => {
    const image = sdfImage(Uint8ClampedArray.from([0, 191]), 2, 1);
    expect([...image.data]).toEqual([255, 255, 255, 0, 255, 255, 255, 191]);
  });
});

describe("icon SVGs", () => {
  it("use only attributes valid for their shapes", () => {
    // `cy` on a <rect> is silently ignored (the shape lands at y = 0).
    for (const { body, accent } of Object.values(FAMILY_ICONS)) {
      for (const svg of [body, accent]) expect(svg).not.toMatch(/<rect[^>]*\scy=/);
    }
  });
});
