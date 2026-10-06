/**
 * Link previews for public airline pages (S50). Pure and dependency-free so
 * the Cloudflare Pages Function (`functions/airline/[npub].ts`) can import it
 * and the web tests can cover it.
 */

/** Must equal the checkpoint d-tag in @acars/nostr (a test checks it). */
export const CHECKPOINT_D_TAG = "airtr:world:v6-beta:checkpoint";
export const CHECKPOINT_KIND = 30078;

// --- bech32 (NIP-19 npub) -------------------------------------------------

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

/** Hex pubkey from an npub (or a 64-hex key), or null if invalid. */
export function decodeNpub(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (/^[0-9a-f]{64}$/.test(value)) return value;
  const sep = value.lastIndexOf("1");
  if (value.slice(0, sep) !== "npub" || value.length > 90) return null;
  const data: number[] = [];
  for (const char of value.slice(sep + 1)) {
    const index = CHARSET.indexOf(char);
    if (index === -1) return null;
    data.push(index);
  }
  const hrp = [..."npub"].map((c) => c.charCodeAt(0));
  const expanded = [...hrp.map((c) => c >> 5), 0, ...hrp.map((c) => c & 31)];
  if (data.length < 6 || polymod([...expanded, ...data]) !== 1) return null;
  // 5-bit groups → bytes.
  let acc = 0;
  let bits = 0;
  const bytes: number[] = [];
  for (const group of data.slice(0, -6)) {
    acc = (acc << 5) | group;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  if (bytes.length !== 32) return null;
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- checkpoint → summary ----------------------------------------------------

export interface AirlineSummary {
  name: string;
  icaoCode: string;
  tier: number;
  aircraft: number;
  routes: number;
  hubs: string[];
  colors: { primary: string; accent: string };
  routeList: Array<{ originIata: string; destinationIata: string }>;
  liveryImageUrl: string | null;
}

const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const color = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

/** Summary of an airline from its checkpoint event content, or null. */
export function summarizeCheckpoint(content: string): AirlineSummary | null {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { airline, fleet, routes } = data as {
    airline?: Record<string, unknown>;
    fleet?: unknown;
    routes?: unknown;
  };
  if (!airline || typeof airline.name !== "string" || !airline.name.trim()) return null;
  const fleetList = Array.isArray(fleet) ? (fleet as Array<Record<string, unknown>>) : [];
  const routeList = (
    Array.isArray(routes) ? (routes as Array<Record<string, unknown>>) : []
  ).filter((route) => route?.status === "active");
  const livery = (airline.livery ?? {}) as Record<string, unknown>;
  const liveried = fleetList.find(
    (ac) =>
      typeof ac?.liveryImageUrl === "string" && /^https:\/\//.test(ac.liveryImageUrl as string),
  );
  return {
    name: airline.name.trim().slice(0, 60),
    icaoCode: str(airline.icaoCode).slice(0, 4),
    tier: typeof airline.tier === "number" ? airline.tier : 1,
    aircraft: fleetList.length,
    routes: routeList.length,
    hubs: Array.isArray(airline.hubs)
      ? (airline.hubs as unknown[]).filter((h): h is string => typeof h === "string")
      : [],
    colors: { primary: color(livery.primary, "#1e3a8a"), accent: color(livery.accent, "#fbbf24") },
    routeList: routeList
      .map((route) => ({
        originIata: str(route.originIata),
        destinationIata: str(route.destinationIata),
      }))
      .filter((route) => route.originIata && route.destinationIata),
    liveryImageUrl: liveried ? (liveried.liveryImageUrl as string) : null,
  };
}

/** Newest valid summary among checkpoint events (relays may return several). */
export function latestSummary(
  events: ReadonlyArray<{ created_at: number; content: string; tags: string[][] }>,
) {
  let best: { at: number; summary: AirlineSummary } | null = null;
  for (const event of events) {
    if (event.tags.find((tag) => tag[0] === "d")?.[1] !== CHECKPOINT_D_TAG) continue;
    const summary = summarizeCheckpoint(event.content);
    if (summary && (!best || event.created_at > best.at)) best = { at: event.created_at, summary };
  }
  return best?.summary ?? null;
}

// --- meta tags --------------------------------------------------------------

export interface PageMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string;
}

export function buildAirlineMeta(
  summary: AirlineSummary | null,
  url: string,
  image: string,
): PageMeta {
  if (!summary) {
    return {
      title: "An airline on ACARS",
      description: "Run a real airline on the real clock. Start yours on ACARS.",
      url,
      image,
      imageAlt: "ACARS: a live route network on a dark globe.",
    };
  }
  const code = summary.icaoCode ? ` (${summary.icaoCode})` : "";
  return {
    title: `${summary.name}${code} on ACARS`,
    description: `${summary.aircraft} aircraft · ${summary.routes} routes · Tier ${summary.tier}${
      summary.hubs.length ? ` · hub ${summary.hubs[0]}` : ""
    }. Run a real airline on the real clock.`,
    url,
    image,
    imageAlt: `${summary.name}'s route network and fleet on ACARS.`,
  };
}

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Replaces the page's title, description, Open Graph and Twitter tags. */
export function injectMeta(html: string, meta: PageMeta): string {
  const title = escape(meta.title);
  const description = escape(meta.description);
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${escape(meta.url)}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:site_name" content="ACARS" />`,
    `<meta property="og:url" content="${escape(meta.url)}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${escape(meta.image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escape(meta.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${escape(meta.image)}" />`,
  ].join("\n  ");
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(
      /<meta\s+(?:name|property)="(?:description|og:[^"]+|twitter:[^"]+)"[\s\S]*?\/?>\s*/gi,
      "",
    )
    .replace(/<link\s+rel="canonical"[^>]*>\s*/i, "");
  return stripped.replace(/<\/head>/i, `  ${tags}\n</head>`);
}
