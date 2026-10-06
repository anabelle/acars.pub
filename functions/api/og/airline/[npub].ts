/**
 * /api/og/airline/:npub — the airline's generated link-preview image
 * (S50.3): a 1200×630 PNG with livery colours, route map and key stats.
 *
 * Uses the same relay-read summary as /airline/:npub (cached briefly), and
 * caches the rendered PNG at the edge. Any failure — bad key, airline not
 * found, render error — serves the generic /og.png instead.
 */
import { airports } from "../../../../packages/data/src/airports";
import { renderAirlineCardPng } from "../../../../apps/web/src/features/airline/utils/ogImage";
import {
  type AirlineSummary,
  decodeNpub,
} from "../../../../apps/web/src/features/airline/utils/ogMeta";
import type { MapAirport } from "../../../../apps/web/src/features/airline/utils/routeMap";
import { cachedSummary } from "../../../airline/[npub]";

export const IMAGE_TTL_S = 600;
const FALLBACK_TTL_S = 60;

export interface AirlineImageDeps {
  /** Fetches a static asset (the generic /og.png) from the Pages build. */
  fetchAsset: (url: URL) => Promise<Response>;
  loadSummary: (pubkey: string) => Promise<AirlineSummary | null>;
  renderPng: (summary: AirlineSummary) => Promise<Uint8Array<ArrayBuffer>>;
}

let airportIndex: Map<string, MapAirport> | undefined;
function airportByIata(iata: string): MapAirport | undefined {
  airportIndex ??= new Map(airports.map((airport) => [airport.iata, airport]));
  return airportIndex.get(iata);
}

export async function handleAirlineImage(
  request: Request,
  npub: string,
  deps: AirlineImageDeps,
): Promise<Response> {
  const fallback = async () => {
    const asset = await deps.fetchAsset(new URL("/og.png", request.url));
    return new Response(asset.body, {
      status: asset.status,
      headers: {
        "content-type": "image/png",
        "cache-control": `public, max-age=${FALLBACK_TTL_S}`,
      },
    });
  };
  const pubkey = decodeNpub(npub);
  if (!pubkey) return fallback();
  try {
    const summary = await deps.loadSummary(pubkey);
    if (!summary) return fallback();
    const png = await deps.renderPng(summary);
    return new Response(png, {
      headers: {
        "content-type": "image/png",
        "cache-control": `public, max-age=${IMAGE_TTL_S}`,
      },
    });
  } catch {
    return fallback();
  }
}

interface PagesContext {
  request: Request;
  params: { npub?: string | string[] };
  env: { ASSETS: { fetch: (input: URL | Request) => Promise<Response> } };
  waitUntil: (promise: Promise<unknown>) => void;
}

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const raw = context.params.npub;
  const npub = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(`https://og-cache.acars.pub/image/${encodeURIComponent(npub)}`);
  const hit = cache ? await cache.match(key) : undefined;
  if (hit) return hit;
  const response = await handleAirlineImage(context.request, npub, {
    fetchAsset: (url) => context.env.ASSETS.fetch(url),
    loadSummary: (pubkey) => cachedSummary(pubkey, (p) => context.waitUntil(p)),
    renderPng: (summary) => renderAirlineCardPng(summary, airportByIata),
  });
  if (cache && response.ok) context.waitUntil(cache.put(key, response.clone()));
  return response;
};
