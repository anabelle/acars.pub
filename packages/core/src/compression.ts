const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const GZ_PREFIX = "gz:";
const RAW_PREFIX = "raw:";

/**
 * Hard cap on the encoded (compressed) snapshot size — anything larger is
 * rejected before any decoding work. 512KB of gzip/base64 already encodes a
 * snapshot far beyond anything the game produces.
 */
export const MAX_COMPRESSED_SNAPSHOT_CHARS = 512 * 1024;

/**
 * Hard cap on decompressed output bytes. A ~256KB gzip payload can inflate to
 * gigabytes (decompression bomb); readers treat a throw here as an invalid
 * snapshot (see store/snapshotValidation.ts).
 */
export const MAX_DECOMPRESSED_SNAPSHOT_BYTES = 8 * 1024 * 1024;

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof globalThis.btoa === "function") {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return globalThis.btoa(binary);
  }
  // Node.js fallback
  const B = (globalThis as Record<string, unknown>).Buffer as
    | { from(data: Uint8Array): { toString(enc: string): string } }
    | undefined;
  if (B) return B.from(bytes).toString("base64");
  throw new Error("No base64 encoder available (neither btoa nor Buffer)");
}

function fromBase64(base64: string): ArrayBuffer {
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  // Node.js fallback
  const B = (globalThis as Record<string, unknown>).Buffer as
    | {
        from(
          data: string,
          enc: string,
        ): { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
      }
    | undefined;
  if (B) {
    const buf = B.from(base64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  throw new Error("No base64 decoder available (neither atob nor Buffer)");
}

export async function compressSnapshotString(input: string): Promise<string> {
  if (typeof CompressionStream === "undefined") {
    return RAW_PREFIX + toBase64(textEncoder.encode(input));
  }
  const stream = new Response(input).body;
  if (!stream) throw new Error("Could not create stream from input");
  const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
  const response = new Response(compressedStream);
  const arrayBuffer = await response.arrayBuffer();
  return GZ_PREFIX + toBase64(arrayBuffer);
}

export async function decompressSnapshotString(b64: string): Promise<string> {
  // Input cap: reject oversized payloads before any base64/gzip work.
  if (b64.length > MAX_COMPRESSED_SNAPSHOT_CHARS) {
    throw new Error(
      `Snapshot compressed input too large (${b64.length} chars > ${MAX_COMPRESSED_SNAPSHOT_CHARS}); rejecting as invalid snapshot`,
    );
  }

  // Self-describing format: check prefix to determine encoding
  if (b64.startsWith(RAW_PREFIX)) {
    const rawBytes = new Uint8Array(fromBase64(b64.slice(RAW_PREFIX.length)));
    if (rawBytes.byteLength > MAX_DECOMPRESSED_SNAPSHOT_BYTES) {
      throw new Error(
        `Snapshot payload exceeds ${MAX_DECOMPRESSED_SNAPSHOT_BYTES} bytes (${rawBytes.byteLength}); rejecting as invalid snapshot`,
      );
    }
    return textDecoder.decode(rawBytes);
  }

  const payload = b64.startsWith(GZ_PREFIX) ? b64.slice(GZ_PREFIX.length) : b64;
  const compressedBuffer = fromBase64(payload);

  if (typeof DecompressionStream === "undefined") {
    // Fallback: try to decode as UTF-8 (legacy uncompressed data without prefix)
    if (compressedBuffer.byteLength > MAX_DECOMPRESSED_SNAPSHOT_BYTES) {
      throw new Error(
        `Snapshot payload exceeds ${MAX_DECOMPRESSED_SNAPSHOT_BYTES} bytes (${compressedBuffer.byteLength}); rejecting as invalid snapshot`,
      );
    }
    return textDecoder.decode(compressedBuffer);
  }
  const stream = new Response(compressedBuffer).body;
  if (!stream) throw new Error("Could not create stream from compacted buffer");
  const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));

  // Incremental read with an output byte counter: a small gzip payload can
  // inflate gigabytes (zip bomb), so abort as soon as the cap is exceeded.
  const reader = decompressedStream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_DECOMPRESSED_SNAPSHOT_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error(
        `Decompressed snapshot exceeds ${MAX_DECOMPRESSED_SNAPSHOT_BYTES} bytes (possible decompression bomb); aborting`,
      );
    }
    chunks.push(value);
  }

  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return textDecoder.decode(output);
}
