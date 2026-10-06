/**
 * /airline/:npub — serves the SPA with link-preview meta for that airline
 * (S50). Crawlers (and everyone else) get index.html with the airline's
 * title, description and image; the client app then renders the page.
 *
 * Data: the airline's latest checkpoint event, read from relays at the edge
 * with a short timeout and cached briefly. No new storage. Any failure
 * falls back to a generic ACARS card, never an error page.
 *
 * Kept dependency-free except for the shared pure helpers in ogMeta.ts.
 */
import {
  type AirlineSummary,
  buildAirlineMeta,
  CHECKPOINT_D_TAG,
  CHECKPOINT_KIND,
  decodeNpub,
  injectMeta,
  latestSummary,
} from "../../apps/web/src/features/airline/utils/ogMeta";

/** Relays tried in order (first answer wins). */
export const OG_RELAYS = ["wss://nostr.acars.pub", "wss://relay.damus.io", "wss://nos.lol"];
const RELAY_TIMEOUT_MS = 2500;
const FOUND_TTL_S = 600;
const MISSING_TTL_S = 60;

export interface AirlinePageDeps {
  /** Fetches a static asset (index.html) from the Pages build. */
  fetchAsset: (url: URL) => Promise<Response>;
  /** The airline's summary, or null. */
  loadSummary: (pubkey: string) => Promise<AirlineSummary | null>;
}

/** The OG image for an airline (S50.3 renders it; generic until then). */
export function ogImageUrl(origin: string, npub: string): string {
  return `${origin}/api/og/airline/${encodeURIComponent(npub)}`;
}

export async function handleAirlinePage(
  request: Request,
  npub: string,
  deps: AirlinePageDeps,
): Promise<Response> {
  const url = new URL(request.url);
  const asset = await deps.fetchAsset(new URL("/index.html", url));
  const html = await asset.text();
  const pubkey = decodeNpub(npub);
  let summary: AirlineSummary | null = null;
  if (pubkey) {
    try {
      summary = await deps.loadSummary(pubkey);
    } catch {
      summary = null;
    }
  }
  const meta = buildAirlineMeta(
    summary,
    `${url.origin}${url.pathname}`,
    ogImageUrl(url.origin, npub),
  );
  return new Response(injectMeta(html, meta), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": `public, max-age=${summary ? 300 : 60}`,
    },
  });
}

// --- relay reading (Workers runtime) -----------------------------------------

interface RelayEvent {
  created_at: number;
  content: string;
  tags: string[][];
}

interface WorkerSocket {
  accept(): void;
  send(data: string): void;
  close(): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: "close" | "error", listener: () => void): void;
}

/** Checkpoint events from one relay, or [] on any failure or timeout. */
export async function readCheckpointEvents(
  relay: string,
  pubkey: string,
  fetchImpl: (input: string, init: RequestInit) => Promise<Response> = fetch,
  timeoutMs = RELAY_TIMEOUT_MS,
): Promise<RelayEvent[]> {
  let socket: WorkerSocket | undefined;
  try {
    const response = await fetchImpl(relay.replace(/^wss:/, "https:"), {
      headers: { Upgrade: "websocket" },
    });
    socket = (response as Response & { webSocket?: WorkerSocket }).webSocket ?? undefined;
  } catch {
    return [];
  }
  if (!socket) return [];
  const ws = socket;
  ws.accept();
  const subId = `og-${pubkey.slice(0, 8)}`;
  return new Promise<RelayEvent[]>((resolve) => {
    const events: RelayEvent[] = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // already closed
      }
      resolve(events);
    };
    const timer = setTimeout(finish, timeoutMs);
    ws.addEventListener("message", (message) => {
      try {
        const data = JSON.parse(String(message.data));
        if (!Array.isArray(data) || data[1] !== subId) return;
        if (data[0] === "EVENT" && data[2]) events.push(data[2] as RelayEvent);
        else if (data[0] === "EOSE" || data[0] === "CLOSED") finish();
      } catch {
        // ignore malformed frames
      }
    });
    ws.addEventListener("close", finish);
    ws.addEventListener("error", finish);
    ws.send(
      JSON.stringify([
        "REQ",
        subId,
        { kinds: [CHECKPOINT_KIND], authors: [pubkey], "#d": [CHECKPOINT_D_TAG], limit: 3 },
      ]),
    );
  });
}

/** Tries relays in order until one returns a valid checkpoint. */
export async function loadSummaryFromRelays(
  pubkey: string,
  relays: readonly string[] = OG_RELAYS,
  read: (relay: string, pubkey: string) => Promise<RelayEvent[]> = readCheckpointEvents,
): Promise<AirlineSummary | null> {
  for (const relay of relays) {
    const summary = latestSummary(await read(relay, pubkey));
    if (summary) return summary;
  }
  return null;
}

/** Edge-cached summary (Workers `caches.default`); null results cache briefly. */
async function cachedSummary(pubkey: string, waitUntil: (p: Promise<unknown>) => void) {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(`https://og-cache.acars.pub/airline/${pubkey}`);
  const hit = cache ? await cache.match(key) : undefined;
  if (hit) return (await hit.json()) as AirlineSummary | null;
  const summary = await loadSummaryFromRelays(pubkey);
  if (cache) {
    const ttl = summary ? FOUND_TTL_S : MISSING_TTL_S;
    waitUntil(
      cache.put(
        key,
        new Response(JSON.stringify(summary), {
          headers: { "cache-control": `public, max-age=${ttl}` },
        }),
      ),
    );
  }
  return summary;
}

interface PagesContext {
  request: Request;
  params: { npub?: string | string[] };
  env: { ASSETS: { fetch: (input: URL | Request) => Promise<Response> } };
  waitUntil: (promise: Promise<unknown>) => void;
}

export const onRequestGet = (context: PagesContext): Promise<Response> => {
  const raw = context.params.npub;
  const npub = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return handleAirlinePage(context.request, npub, {
    fetchAsset: (url) => context.env.ASSETS.fetch(url),
    loadSummary: (pubkey) => cachedSummary(pubkey, (p) => context.waitUntil(p)),
  });
};
