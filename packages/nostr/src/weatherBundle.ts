import type { WeatherFactors } from "@acars/core";
import { decodeWeather, encodeWeather } from "@acars/core";

/**
 * Weather bundles (S68): one addressable Nostr event per UTC hour, signed by
 * the world's weather key, carrying every reported airport's factors in a
 * few bytes. Pure helpers — the publisher script and the client share them.
 */

export const WEATHER_KIND = 30078;
/** Same world as the action log (schema.ts WORLD_ID). */
export const WEATHER_WORLD_ID = "v6-beta";
export const WEATHER_D_PREFIX = `airtr:world:${WEATHER_WORLD_ID}:weather:`;
const MAX_CONTENT_CHARS = 128 * 1024;
const MAX_AIRPORTS = 6000;

/** "2026101214" for the UTC hour containing `ms`. */
export function weatherHourKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;
}

/** Start of a "YYYYMMDDHH" hour in ms, or null when malformed. */
export function weatherHourStartMs(key: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})$/.exec(key);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]));
  return weatherHourKey(ms) === key ? ms : null;
}

export function weatherDTag(hourKey: string): string {
  return `${WEATHER_D_PREFIX}${hourKey}`;
}

export interface WeatherBundle {
  hourKey: string;
  issuedAtMs: number;
  airports: Map<string, WeatherFactors>;
}

/** The unsigned event a bundle is published as. */
export function buildWeatherEvent(
  bundle: { issuedAtMs: number; airports: ReadonlyMap<string, WeatherFactors> },
  createdAtSec = Math.floor(bundle.issuedAtMs / 1000),
) {
  const hourKey = weatherHourKey(bundle.issuedAtMs);
  const airports: Record<string, ReturnType<typeof encodeWeather>> = {};
  for (const [iata, factors] of [...bundle.airports].sort((a, b) => a[0].localeCompare(b[0]))) {
    airports[iata] = encodeWeather(factors);
  }
  return {
    kind: WEATHER_KIND,
    created_at: createdAtSec,
    tags: [
      ["d", weatherDTag(hourKey)],
      ["world", WEATHER_WORLD_ID],
      ["t", "acars-weather"],
    ],
    content: JSON.stringify({ v: 1, issued: new Date(bundle.issuedAtMs).toISOString(), airports }),
  };
}

/**
 * A bundle from an event, or null unless it is a well-formed weather event
 * by `weatherPubkey`: right kind, d-tag and hour, a sane content size, and
 * every airport a 3-letter code with valid factors.
 */
export function parseWeatherEvent(
  event: { kind?: number; pubkey?: string; tags?: string[][]; content?: string },
  weatherPubkey: string,
): WeatherBundle | null {
  if (!weatherPubkey || event.pubkey !== weatherPubkey || event.kind !== WEATHER_KIND) return null;
  const d = event.tags?.find((tag) => tag[0] === "d")?.[1] ?? "";
  if (!d.startsWith(WEATHER_D_PREFIX)) return null;
  const hourKey = d.slice(WEATHER_D_PREFIX.length);
  if (weatherHourStartMs(hourKey) === null) return null;
  if (typeof event.content !== "string" || event.content.length > MAX_CONTENT_CHARS) return null;
  let data: unknown;
  try {
    data = JSON.parse(event.content);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { issued, airports } = data as { issued?: unknown; airports?: unknown };
  const issuedAtMs = typeof issued === "string" ? Date.parse(issued) : Number.NaN;
  if (!Number.isFinite(issuedAtMs) || weatherHourKey(issuedAtMs) !== hourKey) return null;
  if (typeof airports !== "object" || airports === null) return null;
  const entries = Object.entries(airports as Record<string, unknown>);
  if (entries.length > MAX_AIRPORTS) return null;
  const map = new Map<string, WeatherFactors>();
  for (const [iata, value] of entries) {
    const factors = decodeWeather(value);
    if (!/^[A-Z]{3}$/.test(iata) || !factors) return null;
    map.set(iata, factors);
  }
  return { hourKey, issuedAtMs, airports: map };
}
