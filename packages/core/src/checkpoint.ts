import type { AircraftInstance, AirlineEntity, Route, TimelineEvent } from "./types.js";

const textEncoder = new TextEncoder();

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (typeof entry === "undefined") continue;
      sorted[key] = sortValue(entry);
    }
    return sorted;
  }

  return value;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

async function sha256(input: string): Promise<string> {
  if (!globalThis.crypto?.subtle?.digest) {
    throw new Error("crypto.subtle is not available in this environment.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", textEncoder.encode(input));
  return toHex(digest);
}

export async function computeActionChainHash(
  previousHash: string,
  input: unknown,
): Promise<string> {
  const canonical = canonicalize(input);
  return sha256(`${previousHash}\n${canonical}`);
}

export async function computeCheckpointStateHash(params: {
  airline: AirlineEntity;
  fleet: AircraftInstance[];
  routes: Route[];
  timeline: TimelineEvent[];
}): Promise<string> {
  const sortedFleet = [...params.fleet].sort((a, b) => a.id.localeCompare(b.id));
  const sortedRoutes = [...params.routes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedTimeline = [...params.timeline].sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    return a.id.localeCompare(b.id);
  });

  const canonical = canonicalize({
    airline: params.airline,
    fleet: sortedFleet,
    routes: sortedRoutes,
    timeline: sortedTimeline,
  });

  return sha256(canonical);
}

export async function verifyCheckpoint(params: {
  actionChainHash: string;
  expectedActionChainHash: string;
  expectedStateHash: string;
  airline: AirlineEntity;
  fleet: AircraftInstance[];
  routes: Route[];
  timeline: TimelineEvent[];
}): Promise<boolean> {
  if (params.actionChainHash !== params.expectedActionChainHash) return false;
  const stateHash = await computeCheckpointStateHash({
    airline: params.airline,
    fleet: params.fleet,
    routes: params.routes,
    timeline: params.timeline,
  });
  return stateHash === params.expectedStateHash;
}
