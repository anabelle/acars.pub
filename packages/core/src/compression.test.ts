import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compressSnapshotString, decompressSnapshotString } from "./compression.js";

describe("compression round-trip", () => {
  it("round-trips arbitrary JSON via gzip prefix", async () => {
    const input = JSON.stringify({ fleet: [{ id: "a", v: 123 }], n: 9999 });
    const compressed = await compressSnapshotString(input);
    expect(compressed.startsWith("gz:")).toBe(true);
    const restored = await decompressSnapshotString(compressed);
    expect(restored).toBe(input);
  });

  it("round-trips a large payload and actually compresses it", async () => {
    const input = "ACARS".repeat(5000);
    const compressed = await compressSnapshotString(input);
    expect(compressed.length).toBeLessThan(input.length);
    expect(await decompressSnapshotString(compressed)).toBe(input);
  });

  it("decompresses a raw:-prefixed (uncompressed) payload", async () => {
    // btoa only encodes Latin-1, so use an ASCII string for the hand-built
    // raw: payload (the gzip path above already exercises UTF-8).
    const input = "plain ascii content";
    const rawBase64 = globalThis.btoa(input);
    const restored = await decompressSnapshotString(`raw:${rawBase64}`);
    expect(restored).toBe(input);
  });

  it("treats a payload without any prefix as gzip data", async () => {
    const input = "no prefix here";
    const compressed = await compressSnapshotString(input);
    const stripped = compressed.slice("gz:".length);
    expect(await decompressSnapshotString(stripped)).toBe(input);
  });

  it("preserves UTF-8 multibyte content", async () => {
    const input = "avión ✈️ Bogotá — Medellín";
    expect(await decompressSnapshotString(await compressSnapshotString(input))).toBe(input);
  });
});

describe("compression fallback (no CompressionStream)", () => {
  const originalCompression = (globalThis as { CompressionStream?: unknown }).CompressionStream;
  const originalDecompression = (globalThis as { DecompressionStream?: unknown })
    .DecompressionStream;

  beforeEach(() => {
    delete (globalThis as { CompressionStream?: unknown }).CompressionStream;
    delete (globalThis as { DecompressionStream?: unknown }).DecompressionStream;
  });

  afterEach(() => {
    (globalThis as { CompressionStream?: unknown }).CompressionStream = originalCompression;
    (globalThis as { DecompressionStream?: unknown }).DecompressionStream = originalDecompression;
  });

  it("falls back to raw: base64 when CompressionStream is unavailable", async () => {
    const input = "fallback payload";
    const compressed = await compressSnapshotString(input);
    expect(compressed.startsWith("raw:")).toBe(true);
    expect(await decompressSnapshotString(compressed)).toBe(input);
  });

  it("decodes a gz:-prefixed payload as UTF-8 when DecompressionStream is unavailable", async () => {
    // Build a gz: payload under the real compressor first (restoring globals),
    // then strip the decompressor for the decode path.
    (globalThis as { CompressionStream?: unknown }).CompressionStream = originalCompression;
    const input = "gz-then-raw-decode";
    const compressed = await compressSnapshotString(input); // gz:...
    delete (globalThis as { CompressionStream?: unknown }).CompressionStream;

    // Without DecompressionStream the decoder falls back to UTF-8 decoding of
    // the gzip bytes — which is NOT the original string, but must not throw and
    // must return a string (the UTF-8 interpretation of the gzip header).
    const result = await decompressSnapshotString(compressed);
    expect(typeof result).toBe("string");
  });
});

describe("compression base64 Buffer fallback", () => {
  // Node provides btoa/atob globally; force them off to exercise the Buffer
  // fallbacks in toBase64()/fromBase64().
  const originalBtoa = (globalThis as { btoa?: unknown }).btoa;
  const originalAtob = (globalThis as { atob?: unknown }).atob;

  beforeEach(() => {
    delete (globalThis as { btoa?: unknown }).btoa;
    delete (globalThis as { atob?: unknown }).atob;
  });

  afterEach(() => {
    (globalThis as { btoa?: unknown }).btoa = originalBtoa;
    (globalThis as { atob?: unknown }).atob = originalAtob;
  });

  it("round-trips via the Buffer fallback when btoa/atob are unavailable", async () => {
    const input = "buffer-fallback-content";
    const compressed = await compressSnapshotString(input);
    expect(compressed.startsWith("gz:")).toBe(true);
    expect(await decompressSnapshotString(compressed)).toBe(input);
  });

  it("round-trips a raw payload via the Buffer fallback", async () => {
    const input = "raw-buffer";
    const compressed = await compressSnapshotString(input);
    expect(await decompressSnapshotString(compressed)).toBe(input);
  });
});
