import type { Page, WebSocketRoute } from "@playwright/test";

/** A Nostr event as relays see it. */
interface RelayEvent {
  id: string;
  pubkey: string;
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  sig: string;
}

type Filter = Record<string, unknown> & {
  ids?: string[];
  kinds?: number[];
  authors?: string[];
  since?: number;
  until?: number;
  limit?: number;
};

function matches(event: RelayEvent, filter: Filter): boolean {
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.since !== undefined && event.created_at < filter.since) return false;
  if (filter.until !== undefined && event.created_at > filter.until) return false;
  for (const [key, values] of Object.entries(filter)) {
    if (!key.startsWith("#") || !Array.isArray(values)) continue;
    const name = key.slice(1);
    if (!event.tags.some((tag) => tag[0] === name && values.includes(tag[1]))) return false;
  }
  return true;
}

const replaceKey = (event: RelayEvent): string | null => {
  if (event.kind >= 30000 && event.kind < 40000) {
    const d = event.tags.find((tag) => tag[0] === "d")?.[1] ?? "";
    return `${event.kind}:${event.pubkey}:${d}`;
  }
  if (event.kind === 0 || event.kind === 3 || (event.kind >= 10000 && event.kind < 20000)) {
    return `${event.kind}:${event.pubkey}`;
  }
  return null;
};

/**
 * One fake relay shared by several pages (S73): it keeps what is published
 * and serves it back, live, to every subscription — so two players in two
 * browser contexts see each other, as on a real relay.
 */
export function sharedRelay() {
  const events = new Map<string, RelayEvent>();
  const subs = new Map<string, { ws: WebSocketRoute; id: string; filters: Filter[] }>();
  let socketId = 0;

  const store = (event: RelayEvent) => {
    if (events.has(event.id)) return false;
    const key = replaceKey(event);
    if (key) {
      for (const [id, existing] of events) {
        if (replaceKey(existing) === key) {
          if (existing.created_at > event.created_at) return false;
          events.delete(id);
        }
      }
    }
    events.set(event.id, event);
    return true;
  };

  return {
    /** Everything the relay holds now, for assertions. */
    published(): RelayEvent[] {
      return [...events.values()];
    },
    async attach(page: Page): Promise<void> {
      await page.routeWebSocket(/^wss?:\/\//, (ws) => {
        const socket = ++socketId;
        ws.onMessage((raw) => {
          let message: unknown;
          try {
            message = JSON.parse(typeof raw === "string" ? raw : raw.toString());
          } catch {
            return;
          }
          if (!Array.isArray(message)) return;
          const [type, first, ...rest] = message as [string, unknown, ...unknown[]];
          if (type === "REQ" && typeof first === "string") {
            const filters = rest.filter((f): f is Filter => Boolean(f) && typeof f === "object");
            subs.set(`${socket}:${first}`, { ws, id: first, filters });
            const sent = new Set<string>();
            for (const filter of filters) {
              const found = [...events.values()]
                .filter((event) => matches(event, filter))
                .sort((a, b) => b.created_at - a.created_at)
                .slice(0, filter.limit ?? Number.POSITIVE_INFINITY);
              for (const event of found) {
                if (sent.has(event.id)) continue;
                sent.add(event.id);
                ws.send(JSON.stringify(["EVENT", first, event]));
              }
            }
            ws.send(JSON.stringify(["EOSE", first]));
          } else if (type === "CLOSE" && typeof first === "string") {
            subs.delete(`${socket}:${first}`);
          } else if (type === "EVENT" && first && typeof first === "object" && "id" in first) {
            const event = first as RelayEvent;
            ws.send(JSON.stringify(["OK", event.id, true, ""]));
            if (!store(event)) return;
            for (const sub of subs.values()) {
              if (sub.filters.some((filter) => matches(event, filter))) {
                sub.ws.send(JSON.stringify(["EVENT", sub.id, event]));
              }
            }
          }
        });
      });
    },
  };
}
