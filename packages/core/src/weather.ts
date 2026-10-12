import { TICKS_PER_HOUR } from "./types.js";

/**
 * Real weather (S68, D11): METAR reports reduced to a few factors that set
 * how an airport slows departures. Reports are published hourly as signed
 * Nostr bundles by the world's weather key; a missing report means calm.
 * Pure and deterministic: the same bundle gives every client the same delays.
 */

/** VFR, marginal VFR, IFR, low IFR: the aviation flight categories. */
export type FlightCategory = 0 | 1 | 2 | 3;
export const FLIGHT_CATEGORY_NAMES = ["VFR", "MVFR", "IFR", "LIFR"] as const;

export interface WeatherFactors {
  category: FlightCategory;
  /** Gusts in knots (0 when none). */
  gustKt: number;
  thunderstorm: boolean;
  fog: boolean;
  snow: boolean;
}

export const CALM: WeatherFactors = {
  category: 0,
  gustKt: 0,
  thunderstorm: false,
  fog: false,
  snow: false,
};

const TICKS_PER_MINUTE = TICKS_PER_HOUR / 60;
/** A report issued at HH:00 affects departures from HH:20 (published with a fixed lag). */
export const WEATHER_LAG_TICKS = 20 * TICKS_PER_MINUTE;

/** Visibility in statute miles from a METAR group ("10SM", "1/2SM", "1 1/2SM", "9999", "0800"). */
function visibilitySm(tokens: readonly string[]): number | null {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const sm = /^(M)?(\d+)?(?:\/(\d+))?SM$/.exec(t);
    if (sm) {
      let value = sm[3] ? Number(sm[2]) / Number(sm[3]) : Number(sm[2]);
      const whole = /^\d+$/.exec(tokens[i - 1] ?? "");
      if (sm[3] && whole) value += Number(whole[0]);
      return value;
    }
    if (/^\d{4}$/.test(t) && i > 1) return Number(t) / 1609.34;
  }
  return null;
}

/** Lowest broken/overcast/vertical-visibility layer, in feet. */
function ceilingFt(tokens: readonly string[]): number | null {
  let lowest: number | null = null;
  for (const t of tokens) {
    const layer = /^(BKN|OVC|VV)(\d{3})/.exec(t);
    if (layer) {
      const ft = Number(layer[2]) * 100;
      lowest = lowest === null ? ft : Math.min(lowest, ft);
    }
  }
  return lowest;
}

/**
 * The factors of a raw METAR ("METAR LEMD 121430Z 24015G32KT 3000 TSRA BKN008 …").
 * Unknown groups are ignored; a report it cannot read is calm.
 */
export function parseMetar(raw: string): WeatherFactors {
  const tokens = raw.trim().toUpperCase().split(/\s+/);
  const remarks = tokens.indexOf("RMK");
  const body = remarks >= 0 ? tokens.slice(0, remarks) : tokens;
  const vis = visibilitySm(body);
  const ceiling = ceilingFt(body);
  let category: FlightCategory = 0;
  if ((ceiling !== null && ceiling < 500) || (vis !== null && vis < 1)) category = 3;
  else if ((ceiling !== null && ceiling < 1000) || (vis !== null && vis < 3)) category = 2;
  else if ((ceiling !== null && ceiling <= 3000) || (vis !== null && vis <= 5)) category = 1;
  let gustKt = 0;
  for (const t of body) {
    const wind = /^(?:\d{3}|VRB)\d{2,3}G(\d{2,3})(KT|MPS)$/.exec(t);
    if (wind) gustKt = wind[2] === "MPS" ? Math.round(Number(wind[1]) * 1.944) : Number(wind[1]);
  }
  const weather = body.filter(
    (t) =>
      /^[-+]?(VC)?[A-Z]{2,}$/.test(t) &&
      !/^(METAR|SPECI|AUTO|COR|NOSIG|CAVOK|SKC|CLR|NSC)$/.test(t),
  );
  return {
    category,
    gustKt,
    thunderstorm: weather.some((t) => t.includes("TS")),
    fog: weather.some((t) => /FG/.test(t)),
    snow: weather.some((t) => /SN|PL|GS/.test(t) && !t.startsWith("VC")),
  };
}

/** Compact form for bundles: [category, gust kt, flags (1 TS, 2 FG, 4 SN)]. */
export type CompactWeather = [number, number, number];

export function encodeWeather(f: WeatherFactors): CompactWeather {
  return [f.category, f.gustKt, (f.thunderstorm ? 1 : 0) | (f.fog ? 2 : 0) | (f.snow ? 4 : 0)];
}

export function decodeWeather(value: unknown): WeatherFactors | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [category, gust, flags] = value;
  if (![0, 1, 2, 3].includes(category)) return null;
  if (!Number.isInteger(gust) || gust < 0 || gust > 200) return null;
  if (!Number.isInteger(flags) || flags < 0 || flags > 7) return null;
  return {
    category: category as FlightCategory,
    gustKt: gust,
    thunderstorm: (flags & 1) !== 0,
    fog: (flags & 2) !== 0,
    snow: (flags & 4) !== 0,
  };
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * Extra departure delay an airport's weather causes, in ticks — the same on
 * every client (seeded by the flight): marginal 0–10 min, IFR 10–30, low IFR
 * 30–90, thunderstorms +30–75, snow +20–50, gusts over 35 kt +10–20.
 */
export function weatherDelayTicks(f: WeatherFactors, seed: string): number {
  const h = hash(seed);
  const u = (n: number) => ((h >>> n) % 1000) / 1000;
  let minutes = 0;
  if (f.category === 1) minutes += 10 * u(0);
  else if (f.category === 2) minutes += 10 + 20 * u(0);
  else if (f.category === 3) minutes += 30 + 60 * u(0);
  if (f.thunderstorm) minutes += 30 + 45 * u(3);
  if (f.snow) minutes += 20 + 30 * u(6);
  if (f.gustKt > 35) minutes += 10 + 10 * u(9);
  return Math.round(minutes) * TICKS_PER_MINUTE;
}

/** "IFR · TS · G32" — a short ACARS-style weather line. */
export function describeWeather(f: WeatherFactors): string {
  const parts: string[] = [FLIGHT_CATEGORY_NAMES[f.category]];
  if (f.thunderstorm) parts.push("TS");
  if (f.fog) parts.push("FG");
  if (f.snow) parts.push("SN");
  if (f.gustKt > 0) parts.push(`G${f.gustKt}`);
  return parts.join(" · ");
}
