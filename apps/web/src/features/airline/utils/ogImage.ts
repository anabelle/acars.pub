/**
 * Generated link-preview image for an airline (S50.3): a 1200×630 PNG with
 * the livery colours, the route map and key stats.
 *
 * Drawn into a plain RGB buffer and encoded with the platform's deflate
 * (CompressionStream), so the edge function needs no image or font
 * library. Text uses the 5×7 pixel font in pixelFont.ts.
 */

import type { AirlineSummary } from "./ogMeta";
import { GLYPH_ADVANCE, GLYPH_HEIGHT, glyphRows, textWidth, toFontText } from "./pixelFont";
import { type MapAirport, projectRouteMap } from "./routeMap";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

type Rgb = readonly [number, number, number];

export interface Raster {
  width: number;
  height: number;
  /** RGB, row-major, 3 bytes per pixel. */
  data: Uint8Array<ArrayBuffer>;
}

export const OG_COLORS = {
  background: [11, 18, 32] as Rgb,
  panel: [15, 26, 46] as Rgb,
  panelBorder: [30, 42, 68] as Rgb,
  route: [56, 189, 248] as Rgb,
  airport: [226, 232, 240] as Rgb,
  text: [248, 250, 252] as Rgb,
  muted: [148, 163, 184] as Rgb,
};

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// --- raster primitives --------------------------------------------------------

export function createRaster(width: number, height: number): Raster {
  return { width, height, data: new Uint8Array(new ArrayBuffer(width * height * 3)) };
}

export function pixelAt(raster: Raster, x: number, y: number): Rgb {
  const i = (y * raster.width + x) * 3;
  return [raster.data[i], raster.data[i + 1], raster.data[i + 2]];
}

function blend(raster: Raster, x: number, y: number, color: Rgb, alpha: number) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= raster.width || y >= raster.height) return;
  const i = (y * raster.width + x) * 3;
  const d = raster.data;
  if (alpha >= 1) {
    d[i] = color[0];
    d[i + 1] = color[1];
    d[i + 2] = color[2];
    return;
  }
  const a = alpha;
  d[i] = Math.round(d[i] + (color[0] - d[i]) * a);
  d[i + 1] = Math.round(d[i + 1] + (color[1] - d[i + 1]) * a);
  d[i + 2] = Math.round(d[i + 2] + (color[2] - d[i + 2]) * a);
}

function fillRect(
  raster: Raster,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Rgb,
  alpha = 1,
) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(raster.width, Math.round(x + w));
  const y1 = Math.min(raster.height, Math.round(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) blend(raster, px, py, color, alpha);
  }
}

/** Anti-aliased filled circle. */
function drawDisc(raster: Raster, cx: number, cy: number, radius: number, color: Rgb, alpha = 1) {
  for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y++) {
    for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x++) {
      const coverage = radius + 0.5 - Math.hypot(x - cx, y - cy);
      if (coverage > 0) blend(raster, x, y, color, alpha * Math.min(1, coverage));
    }
  }
}

/**
 * Anti-aliased line of the given width. Walks the major axis and fills a
 * short span across it, so the cost is length × width, not the bounding box.
 */
function drawLine(
  raster: Raster,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: Rgb,
  alpha = 1,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return;
  const steep = Math.abs(dy) > Math.abs(dx);
  // Swap axes so we always walk the major one ("u") and span the minor ("v").
  const [u1, v1, du, dv] = steep ? [y1, x1, dy, dx] : [x1, y1, dx, dy];
  const half = ((width / 2) * length) / Math.abs(du);
  const from = Math.round(Math.min(u1, u1 + du));
  const to = Math.round(Math.max(u1, u1 + du));
  for (let u = from; u <= to; u++) {
    const v = v1 + ((u - u1) / du) * dv;
    for (let w = Math.floor(v - half - 1); w <= Math.ceil(v + half + 1); w++) {
      const coverage = half + 0.5 - Math.abs(w - v);
      if (coverage <= 0) continue;
      const a = alpha * Math.min(1, coverage);
      if (steep) blend(raster, w, u, color, a);
      else blend(raster, u, w, color, a);
    }
  }
}

/** Draws font text (see toFontText) at integer `scale`; returns its width. */
function drawText(raster: Raster, text: string, x: number, y: number, scale: number, color: Rgb) {
  let cursor = x;
  for (const ch of text) {
    const rows = glyphRows(ch) ?? glyphRows("?") ?? [];
    rows.forEach((bits, row) => {
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          fillRect(raster, cursor + col * scale, y + row * scale, scale, scale, color);
        }
      }
    });
    cursor += GLYPH_ADVANCE * scale;
  }
  return textWidth(text, scale);
}

/** Largest scale (of `scales`) at which `text` fits, truncating at the smallest. */
export function fitText(text: string, maxWidth: number, scales: readonly number[]) {
  for (const scale of scales) {
    if (textWidth(text, scale) <= maxWidth) return { text, scale };
  }
  const scale = scales[scales.length - 1];
  const maxChars = Math.floor((maxWidth / scale + 1) / GLYPH_ADVANCE);
  return {
    text: `${[...text]
      .slice(0, Math.max(0, maxChars - 2))
      .join("")
      .trimEnd()}..`,
    scale,
  };
}

// --- the card -----------------------------------------------------------------

const MAP_BOX = { x: 620, y: 56, width: 532, height: 518 };
const LEFT = 56;
const LEFT_WIDTH = 520;

/** Renders the airline's preview card. */
export function renderAirlineCard(
  summary: AirlineSummary,
  airportByIata: (iata: string) => MapAirport | undefined,
): Raster {
  const raster = createRaster(OG_WIDTH, OG_HEIGHT);
  const primary = hexToRgb(summary.colors.primary);
  const accent = hexToRgb(summary.colors.accent);

  // Background: the livery colour fading into the dark base from the left.
  const tint = mix(primary, OG_COLORS.background, 0.45);
  const row = new Uint8Array(OG_WIDTH * 3);
  for (let x = 0; x < OG_WIDTH; x++) {
    row.set(mix(tint, OG_COLORS.background, Math.min(1, x / 760)), x * 3);
  }
  for (let y = 0; y < OG_HEIGHT; y++) raster.data.set(row, y * OG_WIDTH * 3);
  fillRect(raster, 0, 0, OG_WIDTH, 10, primary);
  fillRect(raster, 0, 10, OG_WIDTH, 6, accent);

  // Route map panel.
  const box = MAP_BOX;
  fillRect(raster, box.x - 2, box.y - 2, box.width + 4, box.height + 4, OG_COLORS.panelBorder);
  fillRect(raster, box.x, box.y, box.width, box.height, OG_COLORS.panel);
  const map = projectRouteMap(summary.routeList, airportByIata, {
    width: box.width,
    height: box.height,
    padding: 40,
    hubs: summary.hubs,
  });
  for (const line of map.lines) {
    drawLine(
      raster,
      box.x + line.x1,
      box.y + line.y1,
      box.x + line.x2,
      box.y + line.y2,
      3,
      OG_COLORS.route,
      0.85,
    );
  }
  for (const point of map.points) {
    const px = box.x + point.x;
    const py = box.y + point.y;
    if (point.hub) {
      drawDisc(raster, px, py, 12, accent, 0.3);
      drawDisc(raster, px, py, 7, accent);
    } else {
      drawDisc(raster, px, py, 4.5, OG_COLORS.airport);
    }
  }
  if (map.points.length === 0) {
    const empty = "NO ROUTES YET";
    drawText(
      raster,
      empty,
      box.x + (box.width - textWidth(empty, 4)) / 2,
      box.y + (box.height - GLYPH_HEIGHT * 4) / 2,
      4,
      OG_COLORS.muted,
    );
  }

  // Identity.
  const icao = toFontText(summary.icaoCode);
  let y = 72;
  if (icao) {
    drawText(raster, icao, LEFT, y, 14, OG_COLORS.text);
    y += GLYPH_HEIGHT * 14 + 30;
  }
  const name = fitText(toFontText(summary.name) || icao || "AIRLINE", LEFT_WIDTH, [6, 5, 4, 3]);
  drawText(raster, name.text, LEFT, y, name.scale, OG_COLORS.text);
  y += GLYPH_HEIGHT * name.scale + 20;
  fillRect(raster, LEFT, y, 120, 8, accent);

  // Stats: value in white, label muted.
  const stats: Array<[string, string]> = [
    [String(summary.aircraft), "AIRCRAFT"],
    [String(summary.routes), summary.routes === 1 ? "ROUTE" : "ROUTES"],
    ["TIER", String(summary.tier)],
  ];
  stats.forEach(([value, label], row) => {
    const top = 330 + row * 56;
    const width = drawText(raster, value, LEFT, top, 5, OG_COLORS.text);
    drawText(raster, label, LEFT + width + 5 * GLYPH_ADVANCE, top, 5, OG_COLORS.muted);
  });
  if (summary.hubs.length > 0) {
    const hubs = fitText(
      toFontText(`HUBS ${summary.hubs.slice(0, 4).join(" · ")}`),
      LEFT_WIDTH,
      [3],
    );
    drawText(raster, hubs.text, LEFT, 500, hubs.scale, OG_COLORS.muted);
  }

  // Footer.
  const brandWidth = drawText(raster, "ACARS.PUB", LEFT, 556, 4, OG_COLORS.route);
  drawText(raster, "AIRLINE MMO ON NOSTR", LEFT + brandWidth + 24, 563, 2, OG_COLORS.muted);
  return raster;
}

// --- PNG encoding -------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + payload.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, payload.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  view.setUint32(8 + payload.length, crc32(out.subarray(4, 8 + payload.length)));
  return out;
}

async function zlibDeflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const body = new Response(bytes).body;
  if (!body) throw new Error("no body stream");
  const stream = body.pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Encodes an RGB raster as a truecolour 8-bit PNG (no row filtering). */
export async function encodePng(raster: Raster): Promise<Uint8Array<ArrayBuffer>> {
  const stride = raster.width * 3;
  const scanlines = new Uint8Array(new ArrayBuffer((stride + 1) * raster.height));
  for (let y = 0; y < raster.height; y++) {
    // Filter byte 0 (none), then the row.
    scanlines.set(raster.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, raster.width);
  view.setUint32(4, raster.height);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit, truecolour, deflate, no filter, no interlace
  const parts = [
    Uint8Array.from(PNG_SIGNATURE),
    chunk("IHDR", header),
    chunk("IDAT", await zlibDeflate(scanlines)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** The airline's preview card as PNG bytes. */
export function renderAirlineCardPng(
  summary: AirlineSummary,
  airportByIata: (iata: string) => MapAirport | undefined,
): Promise<Uint8Array<ArrayBuffer>> {
  return encodePng(renderAirlineCard(summary, airportByIata));
}
