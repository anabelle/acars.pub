import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  crc32,
  createRaster,
  encodePng,
  fitText,
  hexToRgb,
  OG_COLORS,
  OG_HEIGHT,
  OG_WIDTH,
  pixelAt,
  renderAirlineCard,
  renderAirlineCardPng,
} from "./ogImage";
import type { AirlineSummary } from "./ogMeta";
import { glyphRows, textWidth, toFontText } from "./pixelFont";

const AIRPORTS = {
  MAD: { iata: "MAD", latitude: 40.47, longitude: -3.56 },
  BCN: { iata: "BCN", latitude: 41.3, longitude: 2.08 },
  LIS: { iata: "LIS", latitude: 38.78, longitude: -9.14 },
};
const lookup = (iata: string) => AIRPORTS[iata as keyof typeof AIRPORTS];

const summary: AirlineSummary = {
  name: "Iberia Exprés",
  icaoCode: "IBX",
  tier: 2,
  aircraft: 14,
  routes: 2,
  hubs: ["MAD"],
  colors: { primary: "#c8102e", accent: "#ffcc00" },
  routeList: [
    { originIata: "MAD", destinationIata: "BCN" },
    { originIata: "MAD", destinationIata: "LIS" },
  ],
  liveryImageUrl: null,
};

const near = (a: readonly number[], b: readonly number[], tolerance = 24) =>
  a.every((v, i) => Math.abs(v - b[i]) <= tolerance);

describe("pixelFont", () => {
  it("normalises text to drawable characters", () => {
    expect(toFontText("  Iberia   Exprés ")).toBe("IBERIA EXPRES");
    expect(toFontText("航空 Air")).toBe("?? AIR");
  });

  it("has seven 5-bit rows per glyph", () => {
    for (const ch of "AZ09 -.·?") {
      const rows = glyphRows(ch);
      expect(rows).toHaveLength(7);
      for (const row of rows ?? []) expect(row).toBeLessThan(32);
    }
    expect(glyphRows("~")).toBeUndefined();
  });

  it("measures text width without a trailing gap", () => {
    expect(textWidth("", 4)).toBe(0);
    expect(textWidth("A", 4)).toBe(20);
    expect(textWidth("AB", 2)).toBe(22);
  });
});

describe("fitText()", () => {
  it("picks the largest scale that fits", () => {
    expect(fitText("ABCD", 100, [6, 4])).toEqual({ text: "ABCD", scale: 4 });
    expect(fitText("AB", 100, [6, 4])).toEqual({ text: "AB", scale: 6 });
  });

  it("truncates with dots at the smallest scale", () => {
    const fitted = fitText("ABCDEFGHIJKLMNOP", 60, [3]);
    expect(fitted.text.endsWith("..")).toBe(true);
    expect(textWidth(fitted.text, 3)).toBeLessThanOrEqual(60);
  });
});

describe("renderAirlineCard()", () => {
  it("draws the livery stripes, background tint and route map", () => {
    const raster = renderAirlineCard(summary, lookup);
    expect(raster.width).toBe(OG_WIDTH);
    expect(raster.height).toBe(OG_HEIGHT);
    expect(pixelAt(raster, 600, 4)).toEqual(hexToRgb("#c8102e"));
    expect(pixelAt(raster, 600, 12)).toEqual(hexToRgb("#ffcc00"));
    // Tinted towards the livery on the left, plain base on the far right.
    expect(pixelAt(raster, 2, 300)[0]).toBeGreaterThan(OG_COLORS.background[0] + 40);
    expect(pixelAt(raster, OG_WIDTH - 2, 300)).toEqual(OG_COLORS.background);

    // Some pixel in the map panel is route-coloured and one is the hub accent.
    let route = false;
    let hub = false;
    for (let y = 56; y < 574 && !(route && hub); y++) {
      for (let x = 620; x < 1152; x++) {
        const p = pixelAt(raster, x, y);
        if (near(p, OG_COLORS.route, 30)) route = true;
        if (near(p, hexToRgb("#ffcc00"), 4)) hub = true;
      }
    }
    expect(route).toBe(true);
    expect(hub).toBe(true);
  });

  it("draws an empty-map message when nothing is known", () => {
    const raster = renderAirlineCard(
      { ...summary, icaoCode: "", routeList: [], hubs: [] },
      () => undefined,
    );
    let muted = 0;
    for (let y = 290; y < 340; y++) {
      for (let x = 620; x < 1152; x++) if (near(pixelAt(raster, x, y), OG_COLORS.muted, 0)) muted++;
    }
    expect(muted).toBeGreaterThan(100);
  });
});

describe("PNG encoding", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("round-trips pixels through a valid PNG", async () => {
    const raster = createRaster(3, 2);
    raster.data.set([255, 0, 0, 0, 255, 0, 0, 0, 255, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const png = await encodePng(raster);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer, png.byteOffset);

    // Walk the chunks, checking each CRC.
    const chunks: Record<string, Uint8Array> = {};
    let offset = 8;
    while (offset < png.length) {
      const length = view.getUint32(offset);
      const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
      const body = png.subarray(offset + 8, offset + 8 + length);
      expect(view.getUint32(offset + 8 + length)).toBe(
        crc32(png.subarray(offset + 4, offset + 8 + length)),
      );
      chunks[type] = body;
      offset += 12 + length;
    }
    expect(Object.keys(chunks)).toEqual(["IHDR", "IDAT", "IEND"]);
    const header = new DataView(chunks.IHDR.buffer, chunks.IHDR.byteOffset);
    expect([header.getUint32(0), header.getUint32(4)]).toEqual([3, 2]);
    expect([...chunks.IHDR.subarray(8)]).toEqual([8, 2, 0, 0, 0]);
    expect([...inflateSync(chunks.IDAT)]).toEqual([
      0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("renders a full card as a PNG", async () => {
    const png = await renderAirlineCardPng(summary, lookup);
    expect(png.length).toBeGreaterThan(1000);
    expect(png.length).toBeLessThan(200_000);
  });
});
