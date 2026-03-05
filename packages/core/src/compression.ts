const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  let binary = "";
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function compressSnapshotString(input: string): Promise<string> {
  if (typeof CompressionStream === "undefined") {
    console.warn("CompressionStream not supported, returning raw string (as base64)");
    return arrayBufferToBase64(textEncoder.encode(input));
  }
  const stream = new Response(input).body;
  if (!stream) throw new Error("Could not create stream from input");
  const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
  const response = new Response(compressedStream);
  const arrayBuffer = await response.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}

export async function decompressSnapshotString(b64: string): Promise<string> {
  const compressedBuffer = base64ToArrayBuffer(b64);
  if (typeof DecompressionStream === "undefined") {
    console.warn("DecompressionStream not supported, skipping decompression");
    return textDecoder.decode(compressedBuffer);
  }
  const stream = new Response(compressedBuffer).body;
  if (!stream) throw new Error("Could not create stream from compacted buffer");
  const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
  const response = new Response(decompressedStream);
  return await response.text();
}
