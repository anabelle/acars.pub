// =============================================================================
// Signed distance fields for map icons (S42).
//
// MapLibre tints and outlines `sdf: true` images by reading their alpha
// channel as a distance field, with the shape's edge at alpha ≈ 0.75. A plain
// silhouette is a hard 0/255 mask, so scaled up it aliases and shrinks, and
// halos have nothing to work with. These helpers turn a rasterised silhouette
// into a real distance field (same encoding as MapLibre's TinySDF glyphs), so
// icons stay crisp at every zoom and can carry halos.
// =============================================================================

/** Distance (device px) encoded across the alpha range. */
export const SDF_RADIUS = 8;
/** Fraction of the range outside the edge (edge sits at 1 − cutoff ≈ 0.75). */
export const SDF_CUTOFF = 0.25;
/** Logical icon size (px): the coordinate space of WING_TIP_OFFSETS. */
export const ICON_LOGICAL_SIZE = 48;
/** Icons are rasterised at this device-pixel ratio for crisp large zooms. */
export const ICON_PIXEL_RATIO = 2;
/** Transparent margin (logical px) around each icon, room for the field and halos. */
export const ICON_BUFFER = 4;

const INF = 1e20;

/**
 * 1D squared Euclidean distance transform (Felzenszwalb & Huttenlocher),
 * in place over `grid[offset + i * stride]` for i < length.
 */
function edt1d(
  grid: Float64Array,
  offset: number,
  stride: number,
  length: number,
  f: Float64Array,
  v: Uint16Array,
  z: Float64Array,
) {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    const qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}

/** 2D squared distance transform over a width × height grid, in place. */
function edt(grid: Float64Array, width: number, height: number) {
  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const v = new Uint16Array(size);
  const z = new Float64Array(size + 1);
  for (let x = 0; x < width; x++) edt1d(grid, x, width, height, f, v, z);
  for (let y = 0; y < height; y++) edt1d(grid, y * width, 1, width, f, v, z);
}

/**
 * Converts a coverage mask (alpha 0–255 per pixel) into an SDF alpha mask:
 * 255 deep inside, ≈191 on the edge, falling to 0 at `radius` px outside.
 * Anti-aliased edge pixels are placed at sub-pixel distances.
 */
export function alphaToSdf(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  radius = SDF_RADIUS,
  cutoff = SDF_CUTOFF,
): Uint8ClampedArray {
  const count = width * height;
  const outer = new Float64Array(count);
  const inner = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const a = alpha[i] / 255;
    if (a >= 1) {
      outer[i] = 0;
      inner[i] = INF;
    } else if (a <= 0) {
      outer[i] = INF;
      inner[i] = 0;
    } else {
      const d = 0.5 - a;
      outer[i] = d > 0 ? d * d : 0;
      inner[i] = d < 0 ? d * d : 0;
    }
  }
  edt(outer, width, height);
  edt(inner, width, height);
  const out = new Uint8ClampedArray(count);
  for (let i = 0; i < count; i++) {
    const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
    out[i] = Math.round(255 - 255 * (d / radius + cutoff));
  }
  return out;
}

/** Device-pixel dimensions of an icon of `logicalSize` once buffered. */
export function sdfIconDimensions(logicalSize: number) {
  const inner = logicalSize * ICON_PIXEL_RATIO;
  const buffer = ICON_BUFFER * ICON_PIXEL_RATIO;
  return { inner, buffer, size: inner + 2 * buffer };
}

/** An SVG with its root width/height replaced (for rasterising at a given size). */
export function resizeSvg(svg: string, size: number): string {
  return svg.replace(
    /<svg([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/,
    `<svg$1 width="${size}" height="${size}"`,
  );
}

/** Logical size declared on an SVG's root element (its `width`), default 48. */
export function svgLogicalSize(svg: string): number {
  const match = /<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/.exec(svg);
  return match ? Number(match[1]) : ICON_LOGICAL_SIZE;
}

/** Image data MapLibre's `addImage` accepts, alpha holding the distance field. */
export interface SdfImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Wraps an SDF alpha mask as white RGBA (colour comes from `icon-color`). */
export function sdfImage(sdf: Uint8ClampedArray, width: number, height: number): SdfImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < sdf.length; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = sdf[i];
  }
  return { width, height, data };
}
