// =============================================================================
// Contrails behind moving aircraft (S42).
//
// A trail is one static image drawn by a symbol layer on the same flight
// sources as the aircraft: anchored at its top, offset to the tail and
// rotated with the aircraft's bearing. It adds no features and no per-frame
// work; MapLibre instances it like any other icon.
// =============================================================================

/** Logical size (px) of the contrail image, in the aircraft icons' 48 px space. */
export const TRAIL_WIDTH = 10;
export const TRAIL_LENGTH = 80;
/** How far behind the icon centre (48 px space) the trail starts: the tail. */
export const TRAIL_TAIL_OFFSET = 14;
/** Below this zoom aircraft are too small for trails to read. */
export const TRAIL_MIN_ZOOM = 4;

/**
 * RGBA pixels for a white contrail, `pixelRatio` × the logical size. Top row
 * is at the aircraft: narrow and strongest, widening and fading to nothing
 * along its length, with soft edges.
 */
export function buildContrailImage(pixelRatio = 2) {
  const width = TRAIL_WIDTH * pixelRatio;
  const height = TRAIL_LENGTH * pixelRatio;
  const data = new Uint8ClampedArray(width * height * 4);
  const centre = (width - 1) / 2;
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1); // 0 at the aircraft, 1 at the end
    const halfWidth = (width / 2) * (0.25 + 0.75 * t);
    const strength = (1 - t) ** 1.6;
    for (let x = 0; x < width; x++) {
      const edge = Math.max(0, 1 - Math.abs(x - centre) / halfWidth);
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(255 * strength * Math.min(1, edge * 1.5));
    }
  }
  return { width, height, data };
}
