import { type Checkpoint, createLogger, type FixedPoint, FP_ZERO, fpRaw } from "@acars/core";
import type { NDKKind } from "@nostr-dev-kit/ndk";
import { NDKEvent, NDKPublishError, type NDKFilter } from "@nostr-dev-kit/ndk";
import { ensureConnected, getNDK } from "./ndk.js";

const logger = createLogger("Nostr");

/**
 * A validated marketplace listing from Nostr.
 */
export interface MarketplaceListing {
  /** Nostr event ID */
  id: string;
  /** Original aircraft instance ID */
  instanceId: string;
  /** Seller's Nostr pubkey (from event signature, not content) */
  sellerPubkey: string;
  /** Event creation timestamp */
  createdAt: number;
  /** Aircraft model ID */
  modelId: string;
  /** Aircraft display name */
  name: string;
  /** Owner pubkey (from content) */
  ownerPubkey: string;
  /** Asking price (FixedPoint) */
  marketplacePrice: FixedPoint;
  /** When the listing was created */
  listedAt: number;
  /** Aircraft condition 0.0-1.0 */
  condition: number;
  /** Total flight hours */
  flightHoursTotal: number;
  /** Flight hours since last check */
  flightHoursSinceCheck: number;
  /** Tick when aircraft was originally manufactured */
  birthTick: number;
  /** Tick when current owner purchased */
  purchasedAtTick: number;
  /** Original purchase price (FixedPoint) */
  purchasePrice: FixedPoint;
  /** Base airport */
  baseAirportIata: string;
  /** Purchase type */
  purchaseType: "buy" | "lease";
  /** Interior configuration */
  configuration: {
    economy: number;
    business: number;
    first: number;
    cargoKg: number;
  };
  /**
   * True when the seller's fleet is unknown to this client AND the listing is
   * older than the unknown-seller TTL (1h): we cannot verify ownership, so
   * callers may want to filter it out. Absent/undefined = verified fresh.
   */
  staleUnknownSeller?: boolean;
}

export interface CatalogImageRecord {
  modelId: string;
  promptHash: string;
  imageUrl: string;
  updatedAt: number;
}

export type ActionEnvelope = import("@acars/core").GameActionEnvelope;

export interface ActionLogEntry {
  event: NDKEvent;
  action: ActionEnvelope;
}

export const ACTION_KIND = 30078;
export const WORLD_ID = "v6-beta";
const ACARS_SCHEMA_VERSION = 1;
const ACTION_D_PREFIX = `airtr:world:${WORLD_ID}:action:`;
const CHECKPOINT_D_TAG = `airtr:world:${WORLD_ID}:checkpoint`;
export const CATALOG_IMAGE_KIND: NDKKind = 30080 as NDKKind;
export const CATALOG_IMAGE_D_PREFIX = `airtr:world:${WORLD_ID}:catalog-image:`;

const MAX_FUTURE_SKEW_SEC = 5 * 60;
const MAX_EVENT_AGE_SEC = 365 * 24 * 60 * 60;

const ACTION_SCHEMA_VERSION = 2;

/**
 * Anti-inflation caps for relay-driven loaders:
 * - per-payload content cap: events over 128KB are skipped (spam/oversized payloads)
 * - per-author retention cap: at most 2000 action events retained per author
 * - checkpoint author fan-out: relays cap filter `authors` lists (usually ~200-400),
 *   so pubkeys are queried in batches of 200 and fan-in merged
 * - marketplace listings from sellers with no known fleet older than the TTL
 *   are flagged `staleUnknownSeller` instead of silently trusted
 */
const MAX_ACTION_CONTENT_CHARS = 128 * 1024;
const MAX_EVENTS_PER_AUTHOR = 2000;
const CHECKPOINT_AUTHOR_BATCH_SIZE = 200;
const MARKETPLACE_PAGE_LIMIT = 100;
const MARKETPLACE_PAGE_CAP = 10;
const UNKNOWN_SELLER_STALE_TTL_SEC = 3600;

/**
 * Structural actions that must never expire from relays: AIRLINE_CREATE is the
 * genesis event third parties need to bootstrap/replay an airline, and
 * AIRLINE_DISSOLVE is its non-replaceable counterpart. Everything else
 * (TICK_UPDATE, regular actions) keeps the 14-day expiration.
 */
const PERSISTENT_ACTION_TYPES = new Set(["AIRLINE_CREATE", "AIRLINE_DISSOLVE"]);

const ACTION_EXPIRATION_SEC = 14 * 24 * 60 * 60;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.floor(value);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

export function isValidEventTimestamp(createdAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const minValid = now - MAX_EVENT_AGE_SEC;
  const maxValid = now + MAX_FUTURE_SKEW_SEC;
  return createdAt >= minValid && createdAt <= maxValid;
}

export function hasWorldTag(event: NDKEvent, worldId: string): boolean {
  return event.tags.some((tag) => tag[0] === "world" && tag[1] === worldId);
}

export function isActionKind(event: NDKEvent): boolean {
  if (event.kind !== ACTION_KIND) return false;
  const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
  return Boolean(dTag && dTag.startsWith(ACTION_D_PREFIX));
}

export function parseActionContent(data: unknown): ActionEnvelope | null {
  if (!isRecord(data)) return null;
  const schemaVersion = clampInt(data.schemaVersion, 1, 10);
  const action = typeof data.action === "string" ? data.action : null;
  if (!schemaVersion || !action) return null;
  if (!isRecord(data.payload)) return null;
  return {
    schemaVersion,
    action: action as ActionEnvelope["action"],
    payload: data.payload,
  };
}

export function isTransientPublishError(error: unknown): boolean {
  if (!error) return false;

  // Treat NDK structured publish errors as transient. instanceof (not
  // constructor.name, which minifiers mangle) survives production builds.
  if (typeof NDKPublishError === "function" && error instanceof NDKPublishError) return true;

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === "string"
        ? error.toLowerCase()
        : "";

  if (!message) return false;

  const transientPatterns = [
    "timeout",
    "network",
    "connection closed",
    "econnreset",
    "econnrefused",
    "websocket",
    "socket hang up",
    "fetch failed",
    "relay",
    "capacity",
    "rate limit",
    "429",
    "503",
  ];

  return transientPatterns.some((p) => message.includes(p));
}

/**
 * Runs a publish operation with bounded retries on transient errors
 * (relay timeouts, disconnects, rate limits). Non-transient errors rethrow
 * immediately. Shared by action, snapshot and deletion publishes.
 */
export async function withPublishRetry<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; logger?: { warn: (...args: unknown[]) => void } },
): Promise<T> {
  const retries = options?.retries ?? 2;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientPublishError(err) || attempt >= retries) {
        throw err;
      }
      const delay = 1000 * 2 ** attempt; // 1s, 2s, ...
      options?.logger?.warn(
        `Publish attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        err,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export function buildActionDTag(action: ActionEnvelope, seq?: number): string {
  const base = `${ACTION_D_PREFIX}${action.action.toLowerCase()}`;
  if (action.action === "AIRLINE_CREATE" || action.action === "TICK_UPDATE") {
    return base;
  }

  const payload = isRecord(action.payload) ? action.payload : {};
  const idCandidates = [payload.instanceId, payload.routeId, payload.aircraftId, payload.iata];
  const rawId = idCandidates.find((value) => typeof value === "string" && value.trim());
  const id = typeof rawId === "string" ? rawId.trim() : null;
  const tick = isFiniteNumber(payload.tick) ? Math.floor(payload.tick) : null;

  const suffixParts: string[] = [];
  if (id) suffixParts.push(id);
  if (tick !== null) suffixParts.push(String(tick));
  if (typeof seq === "number" && Number.isFinite(seq)) suffixParts.push(`s${Math.floor(seq)}`);

  return suffixParts.length > 0 ? `${base}:${suffixParts.join(":")}` : base;
}

/**
 * Kind for used aircraft listings.
 */
export const MARKETPLACE_KIND: NDKKind = 30079 as NDKKind;
export const MARKETPLACE_D_PREFIX = `airtr:world:${WORLD_ID}:marketplace:`;

/**
 * Publishes an airline creation or update event to Nostr.
 */
export async function publishAirline(): Promise<never> {
  throw new Error("Snapshot publishing is disabled for action-log worlds.");
}

export async function publishCatalogImage(record: CatalogImageRecord): Promise<NDKEvent> {
  await ensureConnected();
  const ndk = getNDK();

  if (!ndk.signer) {
    throw new Error("No signer available. Call attachSigner() first.");
  }

  const event = new NDKEvent(ndk);
  event.kind = CATALOG_IMAGE_KIND;
  event.tags = [
    ["d", `${CATALOG_IMAGE_D_PREFIX}${record.modelId}`],
    ["model", record.modelId],
    ["prompt_hash", record.promptHash],
    ["world", WORLD_ID],
  ];
  event.content = JSON.stringify({
    schemaVersion: ACARS_SCHEMA_VERSION,
    modelId: record.modelId,
    promptHash: record.promptHash,
    imageUrl: record.imageUrl,
    updatedAt: record.updatedAt,
  });

  await event.publish();
  return event;
}

function parseCatalogImageRecord(data: unknown): CatalogImageRecord | null {
  if (!isRecord(data)) return null;
  const promptHash = typeof data.promptHash === "string" ? data.promptHash : null;
  const imageUrl = typeof data.imageUrl === "string" ? data.imageUrl : null;

  if (!promptHash || !imageUrl) {
    return null;
  }

  return {
    modelId: "",
    promptHash,
    imageUrl,
    updatedAt: 0,
  };
}

export async function loadCatalogImages(): Promise<Map<string, CatalogImageRecord>> {
  await ensureConnected();
  const ndk = getNDK();

  const latestByModel = new Map<string, CatalogImageRecord>();

  const pageLimit = 100;
  const pageCap = 10;
  let page = 0;
  let until: number | undefined;

  while (page < pageCap) {
    const filter: NDKFilter = {
      kinds: [CATALOG_IMAGE_KIND],
      limit: pageLimit,
      ...(until ? { until } : {}),
    };

    const pageEvents: NDKEvent[] = [];

    await new Promise<void>((resolve) => {
      const sub = ndk.subscribe(filter, { closeOnEose: true });
      const timeout = setTimeout(() => {
        sub.stop();
        resolve();
      }, 6000);

      sub.on("event", (event: NDKEvent) => {
        pageEvents.push(event);
      });

      sub.on("eose", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    for (const event of pageEvents) {
      if (!hasWorldTag(event, WORLD_ID)) continue;
      const createdAt = event.created_at ?? 0;
      if (!isValidEventTimestamp(createdAt)) continue;
      const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
      if (!dTag?.startsWith(CATALOG_IMAGE_D_PREFIX)) continue;
      if (!event.content.trim().startsWith("{")) continue;

      const modelTag = event.tags.find((tag) => tag[0] === "model")?.[1];
      const modelIdFromDTag = dTag.slice(CATALOG_IMAGE_D_PREFIX.length);
      if (!modelIdFromDTag || modelTag !== modelIdFromDTag) continue;

      try {
        const content = JSON.parse(event.content) as unknown;
        const parsed = parseCatalogImageRecord(content);
        if (!parsed) continue;

        const payloadModelId =
          isRecord(content) && typeof content.modelId === "string" ? content.modelId : null;
        if (payloadModelId && payloadModelId !== modelIdFromDTag) continue;

        const record: CatalogImageRecord = {
          modelId: modelIdFromDTag,
          promptHash: parsed.promptHash,
          imageUrl: parsed.imageUrl,
          updatedAt: createdAt,
        };

        const existing = latestByModel.get(modelIdFromDTag);
        if (!existing || record.updatedAt >= existing.updatedAt) {
          latestByModel.set(modelIdFromDTag, record);
        }
      } catch {
        // Ignore malformed catalog image records
      }
    }

    if (pageEvents.length < pageLimit) break;

    const minCreatedAt = pageEvents.reduce(
      (min, event) => {
        const createdAt = event.created_at ?? 0;
        if (createdAt <= 0) return min;
        return min === null ? createdAt : Math.min(min, createdAt);
      },
      null as number | null,
    );

    if (!minCreatedAt || minCreatedAt <= 0) break;

    until = minCreatedAt - 1;
    page += 1;
  }

  return latestByModel;
}

/**
 * Publishes a single game action event to Nostr.
 *
 * Expiration policy: regular actions (TICK_UPDATE, purchases, ...) expire from
 * relays after 14 days, but structural actions (AIRLINE_CREATE,
 * AIRLINE_DISSOLVE) are published WITHOUT expiration — they are the genesis
 * events third parties need to bootstrap and replay an airline, and must never
 * vanish from relays.
 */
export async function publishAction(action: ActionEnvelope, seq?: number): Promise<NDKEvent> {
  await ensureConnected();
  const ndk = getNDK();

  if (!ndk.signer) {
    throw new Error("No signer available. Call attachSigner() first.");
  }

  const event = new NDKEvent(ndk);
  event.kind = ACTION_KIND;
  event.tags = [
    ["d", buildActionDTag(action, seq)],
    ["world", WORLD_ID],
  ];
  if (!PERSISTENT_ACTION_TYPES.has(action.action)) {
    event.tags.push([
      "expiration",
      Math.floor(Date.now() / 1000 + ACTION_EXPIRATION_SEC).toString(),
    ]);
  }

  event.content = JSON.stringify({
    schemaVersion: ACTION_SCHEMA_VERSION,
    action: action.action,
    payload: action.payload,
  });

  await withPublishRetry(() => event.publish(), { logger });
  return event;
}

/**
 * Loads recent game actions for the current world.
 *
 * Pagination is driven by the RAW page count (like loadCatalogImages): a flood
 * of valid-but-garbage events must not truncate the log, so the loop only
 * stops when a raw page comes back short, advancing `until` to the minimum
 * created_at of the raw page.
 */
export async function loadActionLog(options?: {
  authors?: string[];
  limit?: number;
  maxPages?: number;
  since?: number;
}): Promise<ActionLogEntry[]> {
  await ensureConnected();
  const ndk = getNDK();
  const { authors, limit, maxPages, since } = options ?? {};
  const pageLimit = limit ?? 1000;
  const pageCap = maxPages ?? 10;
  const resultsById = new Map<string, ActionLogEntry>();
  const perAuthorCount = new Map<string, number>();
  const warnedAuthors = new Set<string>();

  let page = 0;
  let until: number | undefined;

  while (page < pageCap) {
    const filter: NDKFilter = {
      kinds: [ACTION_KIND],
      limit: pageLimit,
      ...(authors && authors.length > 0 ? { authors } : {}),
      ...(until ? { until } : {}),
      ...(since ? { since } : {}),
    };

    const pageEvents: NDKEvent[] = [];

    await new Promise<void>((resolve) => {
      const sub = ndk.subscribe(filter, { closeOnEose: true });
      const timeout = setTimeout(() => {
        sub.stop();
        resolve();
      }, 8000);

      sub.on("event", (event: NDKEvent) => {
        pageEvents.push(event);
      });

      sub.on("eose", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    for (const event of pageEvents) {
      if (!hasWorldTag(event, WORLD_ID)) continue;
      if (!isValidEventTimestamp(event.created_at ?? 0)) continue;
      if (!isActionKind(event)) continue;
      const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
      if (dTag === CHECKPOINT_D_TAG) continue;
      if (event.content.length > MAX_ACTION_CONTENT_CHARS) {
        logger.warn(`Skipping oversized action payload (${event.content.length} chars)`);
        continue;
      }
      if (!event.content.trim().startsWith("{")) continue;

      // Per-author retention cap: a spamming author must not be able to
      // pin 10 pages × 1000 payloads in viewer memory. Every candidate event
      // (post kind/world/size filters) consumes budget — garbage included.
      const author = event.author?.pubkey;
      if (author && typeof author === "string") {
        const retained = perAuthorCount.get(author) ?? 0;
        if (retained >= MAX_EVENTS_PER_AUTHOR) {
          if (!warnedAuthors.has(author)) {
            warnedAuthors.add(author);
            logger.warn(
              `Action log retention cap reached for author ${author.slice(0, 8)}… — skipping older events`,
            );
          }
          continue;
        }
        perAuthorCount.set(author, retained + 1);
      }

      try {
        const parsed = parseActionContent(JSON.parse(event.content));
        if (!parsed) continue;
        if (!resultsById.has(event.id)) {
          resultsById.set(event.id, { event, action: parsed });
        }
      } catch {
        // Ignore malformed action payloads
      }
    }

    if (pageEvents.length < pageLimit) break;

    const minCreatedAt = pageEvents.reduce(
      (min, event) => {
        const createdAt = event.created_at ?? 0;
        if (createdAt <= 0) return min;
        return min === null ? createdAt : Math.min(min, createdAt);
      },
      null as number | null,
    );

    if (!minCreatedAt || minCreatedAt <= 0) break;

    until = minCreatedAt - 1;
    page += 1;
  }

  const results = Array.from(resultsById.values());

  results.sort((a, b) => {
    const aTime = a.event.created_at ?? 0;
    const bTime = b.event.created_at ?? 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.event.id.localeCompare(b.event.id);
  });

  return results;
}

export async function subscribeActions(options: {
  onEvent: (entry: ActionLogEntry) => void;
  authors?: string[];
  since?: number;
  onEose?: () => void;
  /** Called when the subscription is closed unexpectedly (relay disconnect, error, etc.) */
  onClose?: () => void;
}): Promise<() => void> {
  await ensureConnected();
  const ndk = getNDK();
  const { onEvent, authors, since, onEose, onClose } = options;

  const filter: NDKFilter = {
    kinds: [ACTION_KIND],
    ...(authors && authors.length > 0 ? { authors } : {}),
    ...(since ? { since } : {}),
  };

  const sub = ndk.subscribe(filter, { closeOnEose: false });
  let intentionallyStopped = false;

  sub.on("event", (event: NDKEvent) => {
    if (!hasWorldTag(event, WORLD_ID)) return;
    if (!isValidEventTimestamp(event.created_at ?? 0)) return;
    if (!isActionKind(event)) return;
    const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
    if (dTag === CHECKPOINT_D_TAG) return;
    if (!event.content.trim().startsWith("{")) return;

    try {
      const parsed = parseActionContent(JSON.parse(event.content));
      if (!parsed) return;
      onEvent({ event, action: parsed });
    } catch {
      // Ignore malformed action payloads
    }
  });

  sub.on("eose", () => {
    onEose?.();
  });

  // Detect unexpected subscription death (relay disconnect, WebSocket close, etc.)
  sub.on("close", () => {
    if (!intentionallyStopped) {
      logger.warn("Live subscription closed unexpectedly — notifying caller for re-subscribe.");
      onClose?.();
    }
  });

  return () => {
    intentionallyStopped = true;
    sub.stop();
  };
}

export function parseCheckpoint(data: unknown): Checkpoint | null {
  if (!isRecord(data)) return null;
  const schemaVersion = clampInt(data.schemaVersion, 1, 10);
  const tick = clampInt(data.tick, 0, Number.MAX_SAFE_INTEGER);
  const createdAt = clampInt(data.createdAt, 0, Number.MAX_SAFE_INTEGER);
  const actionChainHash = typeof data.actionChainHash === "string" ? data.actionChainHash : null;
  const stateHash = typeof data.stateHash === "string" ? data.stateHash : null;
  if (!schemaVersion || tick == null || createdAt == null || !actionChainHash || !stateHash) {
    return null;
  }
  if (!isRecord(data.airline) || !Array.isArray(data.fleet) || !Array.isArray(data.routes)) {
    return null;
  }
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];

  return {
    schemaVersion,
    tick,
    createdAt,
    actionChainHash,
    stateHash,
    airline: data.airline as unknown as Checkpoint["airline"],
    fleet: data.fleet as unknown as Checkpoint["fleet"],
    routes: data.routes as unknown as Checkpoint["routes"],
    timeline: timeline as unknown as Checkpoint["timeline"],
  };
}

export async function loadCheckpoint(pubkey: string): Promise<Checkpoint | null> {
  await ensureConnected();
  const ndk = getNDK();

  const filter: NDKFilter = {
    kinds: [ACTION_KIND],
    authors: [pubkey],
    "#d": [CHECKPOINT_D_TAG],
    limit: 5,
  };

  let latest: Checkpoint | null = null;
  let latestCreatedAt = 0;
  await new Promise<void>((resolve) => {
    const sub = ndk.subscribe(filter, { closeOnEose: true });
    const timeout = setTimeout(() => {
      sub.stop();
      resolve();
    }, 6000);

    sub.on("event", (event: NDKEvent) => {
      if (!hasWorldTag(event, WORLD_ID)) return;
      const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
      if (dTag !== CHECKPOINT_D_TAG) return;
      if (!isValidEventTimestamp(event.created_at ?? 0)) return;
      if (!event.content.trim().startsWith("{")) return;

      try {
        const parsed = parseCheckpoint(JSON.parse(event.content));
        if (!parsed) return;
        if (parsed.createdAt >= latestCreatedAt) {
          latest = parsed;
          latestCreatedAt = parsed.createdAt;
        }
      } catch {
        // Ignore malformed checkpoints
      }
    });

    sub.on("eose", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  return latest;
}

export async function loadCheckpoints(pubkeys: string[]): Promise<Map<string, Checkpoint>> {
  if (pubkeys.length === 0) return new Map();
  await ensureConnected();
  const ndk = getNDK();

  const checkpoints = new Map<string, Checkpoint>();
  const latestByPubkey = new Map<string, number>();

  // Relays cap filter `authors` lists (commonly ~200-400 keys). A single
  // oversized filter gets silently truncated, so partition into batches and
  // fan-in the results (latest checkpoint per pubkey wins).
  for (let i = 0; i < pubkeys.length; i += CHECKPOINT_AUTHOR_BATCH_SIZE) {
    const batch = pubkeys.slice(i, i + CHECKPOINT_AUTHOR_BATCH_SIZE);

    const filter: NDKFilter = {
      kinds: [ACTION_KIND],
      authors: batch,
      "#d": [CHECKPOINT_D_TAG],
      limit: batch.length,
    };

    await new Promise<void>((resolve) => {
      const sub = ndk.subscribe(filter, { closeOnEose: true });
      const timeout = setTimeout(() => {
        sub.stop();
        resolve();
      }, 8000);

      sub.on("event", (event: NDKEvent) => {
        if (!hasWorldTag(event, WORLD_ID)) return;
        const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
        if (dTag !== CHECKPOINT_D_TAG) return;
        if (!isValidEventTimestamp(event.created_at ?? 0)) return;
        if (event.content.length > MAX_ACTION_CONTENT_CHARS) {
          logger.warn(`Skipping oversized checkpoint payload (${event.content.length} chars)`);
          return;
        }
        if (!event.content.trim().startsWith("{")) return;

        try {
          const parsed = parseCheckpoint(JSON.parse(event.content));
          if (!parsed) return;
          const author = event.author.pubkey;
          const lastSeen = latestByPubkey.get(author) ?? 0;
          if (parsed.createdAt >= lastSeen) {
            checkpoints.set(author, parsed);
            latestByPubkey.set(author, parsed.createdAt);
          }
        } catch {
          // Ignore malformed checkpoints
        }
      });

      sub.on("eose", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  return checkpoints;
}

/**
 * Tries to fetch an existing airline configuration for the given pubkey.
 */
export async function loadAirline(): Promise<never> {
  throw new Error("Snapshot loading is disabled for action-log worlds.");
}

/**
 * Publishes an aircraft to the global used marketplace.
 */
export async function publishUsedAircraft(
  aircraft: import("@acars/core").AircraftInstance,
  price: import("@acars/core").FixedPoint,
): Promise<NDKEvent> {
  // Input validation — defense-in-depth against malformed or malicious calls
  if (!aircraft || typeof aircraft.id !== "string" || !aircraft.id) {
    throw new Error("Invalid aircraft: missing id");
  }
  if (typeof aircraft.modelId !== "string" || !aircraft.modelId) {
    throw new Error("Invalid aircraft: missing modelId");
  }
  if (typeof aircraft.ownerPubkey !== "string" || !aircraft.ownerPubkey) {
    throw new Error("Invalid aircraft: missing ownerPubkey");
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error("Invalid listing price: must be a positive finite number");
  }

  await ensureConnected();
  const ndk = getNDK();

  if (!ndk.signer) throw new Error("No signer available. Please check your Nostr extension.");

  logger.info("Publishing used aircraft listing:", aircraft.id, "at price:", price);

  const event = new NDKEvent(ndk);
  event.kind = MARKETPLACE_KIND;
  event.tags = [
    ["d", `${MARKETPLACE_D_PREFIX}${aircraft.id}`],
    ["model", aircraft.modelId],
    ["owner", aircraft.ownerPubkey || "unknown"],
    ["price", price.toString()],
    ["world", WORLD_ID],
  ];

  // Serialize ONLY the listing-relevant fields. The full AircraftInstance
  // carries live flight/route state that bloats the event and leaks stale
  // operational data into the marketplace feed.
  const payload = {
    schemaVersion: ACARS_SCHEMA_VERSION,
    id: aircraft.id,
    modelId: aircraft.modelId,
    ownerPubkey: aircraft.ownerPubkey,
    name: typeof aircraft.name === "string" ? aircraft.name : aircraft.modelId,
    condition: typeof aircraft.condition === "number" ? aircraft.condition : 1,
    flightHoursTotal: typeof aircraft.flightHoursTotal === "number" ? aircraft.flightHoursTotal : 0,
    flightHoursSinceCheck:
      typeof aircraft.flightHoursSinceCheck === "number" ? aircraft.flightHoursSinceCheck : 0,
    birthTick: typeof aircraft.birthTick === "number" ? aircraft.birthTick : 0,
    purchasedAtTick: typeof aircraft.purchasedAtTick === "number" ? aircraft.purchasedAtTick : 0,
    purchasePrice: typeof aircraft.purchasePrice === "number" ? aircraft.purchasePrice : 0,
    purchaseType: aircraft.purchaseType === "lease" ? "lease" : "buy",
    baseAirportIata:
      typeof aircraft.baseAirportIata === "string" ? aircraft.baseAirportIata : "XXX",
    configuration:
      aircraft.configuration && typeof aircraft.configuration === "object"
        ? aircraft.configuration
        : { economy: 0, business: 0, first: 0, cargoKg: 0 },
    marketplacePrice: price,
    listedAt: Date.now(),
  };

  event.content = JSON.stringify(payload);

  logger.info("Broadcasting marketplace event to relays...");
  await event.publish();
  logger.info("Broadcast complete for event:", event.id);
  return event;
}

/**
 * Publishes a NIP-09 deletion request (kind 5) for a used-aircraft listing.
 * Listings are parameterized replaceable events (kind 30079), so the deletion
 * references them via an `a` tag (`30079:<author-pubkey>:<d-tag>`). Relays
 * hide matching events; other clients additionally filter stale listings via
 * ownership cross-referencing.
 */
export async function deleteMarketplaceListing(
  pubkey: string,
  aircraftId: string,
): Promise<NDKEvent> {
  if (!pubkey || typeof pubkey !== "string") {
    throw new Error("deleteMarketplaceListing requires a seller pubkey");
  }
  if (!aircraftId || typeof aircraftId !== "string") {
    throw new Error("deleteMarketplaceListing requires an aircraftId");
  }

  await ensureConnected();
  const ndk = getNDK();
  if (!ndk.signer) throw new Error("No signer available. Call attachSigner() first.");

  const event = new NDKEvent(ndk);
  event.kind = 5;
  event.tags = [
    ["a", `${MARKETPLACE_KIND}:${pubkey}:${MARKETPLACE_D_PREFIX}${aircraftId}`],
    ["k", String(MARKETPLACE_KIND)],
  ];
  event.content = "marketplace listing removed";

  await withPublishRetry(() => event.publish(), { logger });
  return event;
}

/**
 * Validates and parses raw marketplace listing data from a Nostr event.
 * Returns null if the data fails validation or is missing critical fields —
 * listings must be fully self-describing: no fabricated defaults (a made-up
 * condition/hub/listedAt would poison ingest determinism and buyer decisions).
 */
function parseMarketplaceListing(
  data: unknown,
  eventId: string,
  authorPubkey: string,
  createdAt: number,
): MarketplaceListing | null {
  if (!isRecord(data)) return null;

  // Required string fields
  const modelId = typeof data.modelId === "string" ? data.modelId : null;
  const instanceId = typeof data.id === "string" ? data.id : null;
  if (!modelId || !instanceId) return null;

  // Critical display/listing fields: missing → invalid (no "Unknown Aircraft"
  // / "XXX" placeholders, no Date.now() fabrication at ingest time).
  const name = typeof data.name === "string" && data.name.trim() ? data.name : null;
  const ownerPubkey = typeof data.ownerPubkey === "string" ? data.ownerPubkey : authorPubkey;
  const baseAirportIata =
    typeof data.baseAirportIata === "string" && data.baseAirportIata.trim()
      ? data.baseAirportIata
      : null;

  // Price: must be a positive finite number (already in FixedPoint scale from publishUsedAircraft)
  const rawPrice = data.marketplacePrice;
  if (typeof rawPrice !== "number" || !Number.isFinite(rawPrice) || rawPrice <= 0) return null;
  const marketplacePrice = fpRaw(rawPrice);

  // Condition is critical (drives valuation/maintenance math) — reject instead
  // of defaulting to a fabricated 0.5.
  const condition =
    typeof data.condition === "number" && Number.isFinite(data.condition)
      ? Math.max(0, Math.min(1, data.condition))
      : null;

  // listedAt must be declared by the publisher — defaulting to Date.now()
  // made ingest non-deterministic.
  const listedAt =
    typeof data.listedAt === "number" && Number.isFinite(data.listedAt) ? data.listedAt : null;

  if (!name || !baseAirportIata || condition === null || listedAt === null) return null;

  // Numeric fields with safe defaults (use ?? to handle 0 correctly); upper
  // clamps guard against absurd spam values (1e9 ≈ 31k years of ticks).
  const MAX_HOURS = 1e9;
  const MAX_TICK = 1e9;

  const flightHoursTotal =
    typeof data.flightHoursTotal === "number" && Number.isFinite(data.flightHoursTotal)
      ? Math.max(0, Math.min(MAX_HOURS, data.flightHoursTotal))
      : 0;

  const flightHoursSinceCheck =
    typeof data.flightHoursSinceCheck === "number" && Number.isFinite(data.flightHoursSinceCheck)
      ? Math.max(0, Math.min(MAX_HOURS, data.flightHoursSinceCheck))
      : 0;

  const birthTick =
    typeof data.birthTick === "number" && Number.isFinite(data.birthTick)
      ? Math.max(0, Math.min(MAX_TICK, Math.floor(data.birthTick)))
      : 0;
  const purchasedAtTick =
    typeof data.purchasedAtTick === "number" && Number.isFinite(data.purchasedAtTick)
      ? Math.max(0, Math.min(MAX_TICK, Math.floor(data.purchasedAtTick)))
      : 0;

  const purchasePrice =
    typeof data.purchasePrice === "number" && Number.isFinite(data.purchasePrice)
      ? fpRaw(data.purchasePrice)
      : FP_ZERO;

  const purchaseType = data.purchaseType === "lease" ? ("lease" as const) : ("buy" as const);

  // Configuration: validate each field or use sane defaults
  const rawConfig = isRecord(data.configuration) ? data.configuration : null;
  const configuration = {
    economy:
      typeof rawConfig?.economy === "number" ? Math.max(0, Math.round(rawConfig.economy)) : 150,
    business:
      typeof rawConfig?.business === "number" ? Math.max(0, Math.round(rawConfig.business)) : 0,
    first: typeof rawConfig?.first === "number" ? Math.max(0, Math.round(rawConfig.first)) : 0,
    cargoKg:
      typeof rawConfig?.cargoKg === "number" ? Math.max(0, Math.round(rawConfig.cargoKg)) : 0,
  };

  // Verify seller matches content owner (reject impersonation)
  if (ownerPubkey !== authorPubkey) return null;

  return {
    id: eventId,
    instanceId,
    sellerPubkey: authorPubkey,
    createdAt,
    modelId,
    name,
    ownerPubkey,
    marketplacePrice,
    listedAt,
    condition,
    flightHoursTotal,
    flightHoursSinceCheck,
    birthTick,
    purchasedAtTick,
    purchasePrice,
    baseAirportIata,
    purchaseType,
    configuration,
  };
}

/**
 * A map of pubkey -> Set of aircraft instanceIds they currently own.
 * Used to filter stale marketplace listings via ownership cross-referencing.
 */
export type SellerFleetIndex = Map<string, Set<string>>;

/**
 * Loads all active used aircraft listings from the global marketplace.
 *
 * @param sellerFleets - Optional index of ALL known airline fleets (pubkey -> Set<instanceId>).
 *   Used for two-pass ownership verification:
 *   1. If the seller's fleet no longer contains the aircraft → stale (seller removed it).
 *   2. If ANY other airline's fleet contains the aircraft → stale (someone else bought it,
 *      but the seller's client hasn't settled yet — covers pre-existing listings).
 */
export async function loadMarketplace(
  sellerFleets?: SellerFleetIndex,
): Promise<MarketplaceListing[]> {
  await ensureConnected();
  const ndk = getNDK();

  logger.info("Fetching marketplace listings (Kind 30079) from relays...");

  const listingsMap = new Map<string, MarketplaceListing>();

  // Raw-event pagination (same pattern as loadCatalogImages): a global
  // `limit: 100` truncates the marketplace once it grows; pages advance
  // `until` on the raw page's minimum created_at until a short page or cap.
  let page = 0;
  let until: number | undefined;

  while (page < MARKETPLACE_PAGE_CAP) {
    const filter: NDKFilter = {
      kinds: [MARKETPLACE_KIND],
      limit: MARKETPLACE_PAGE_LIMIT,
      ...(until ? { until } : {}),
    };

    const pageEvents: NDKEvent[] = [];

    // We use a manual subscription to collect events as they stream in.
    // This is more resilient than fetchEvents which can be unpredictable with slow relays.
    await new Promise<void>((resolve) => {
      const sub = ndk.subscribe(filter, { closeOnEose: true });
      const timeout = setTimeout(() => {
        sub.stop();
        resolve();
      }, 6000);

      sub.on("event", (event: NDKEvent) => {
        pageEvents.push(event);
      });

      sub.on("eose", () => {
        logger.info("Marketplace fetch received EOSE");
        clearTimeout(timeout);
        resolve();
      });
    });

    for (const event of pageEvents) {
      // Only attempt to parse if it's an ACARS marketplace entry
      const dTag = event.tags.find((t) => t[0] === "d")?.[1];
      if (!dTag?.startsWith(MARKETPLACE_D_PREFIX)) continue;
      if (!hasWorldTag(event, WORLD_ID)) continue;
      if (!isValidEventTimestamp(event.created_at ?? 0)) continue;

      try {
        const data = JSON.parse(event.content);
        const listing = parseMarketplaceListing(
          data,
          event.id,
          event.author.pubkey,
          event.created_at ?? 0,
        );
        if (!listing) continue;

        // Dedup by instanceId:sellerPubkey, keeping latest
        const dedupKey = `${listing.instanceId}:${listing.sellerPubkey}`;
        const existing = listingsMap.get(dedupKey);
        if (!existing || listing.createdAt >= existing.createdAt) {
          listingsMap.set(dedupKey, listing);
        }
      } catch {
        // Silently skip truly malformed events that match our prefix
      }
    }

    if (pageEvents.length < MARKETPLACE_PAGE_LIMIT) break;

    const minCreatedAt = pageEvents.reduce(
      (min, event) => {
        const createdAt = event.created_at ?? 0;
        if (createdAt <= 0) return min;
        return min === null ? createdAt : Math.min(min, createdAt);
      },
      null as number | null,
    );

    if (!minCreatedAt || minCreatedAt <= 0) break;

    until = minCreatedAt - 1;
    page += 1;
  }

  let result = Array.from(listingsMap.values());

  // Ownership verification: filter out stale listings
  if (sellerFleets && sellerFleets.size > 0) {
    // Build reverse index: aircraftId -> ownerPubkey (for all known fleets)
    const aircraftOwner = new Map<string, string>();
    for (const [pubkey, aircraftIds] of sellerFleets) {
      for (const aircraftId of aircraftIds) {
        aircraftOwner.set(aircraftId, pubkey);
      }
    }

    const nowSec = Math.floor(Date.now() / 1000);
    let staleUnknown = 0;

    result = result.filter((listing) => {
      const currentOwner = aircraftOwner.get(listing.instanceId);

      // Check 1: If another airline (not the seller) now owns this aircraft,
      // it was already purchased. The seller's state may not be updated yet
      // (pre-settlement), but the listing is definitely stale.
      if (currentOwner && currentOwner !== listing.sellerPubkey) {
        logger.info(
          `Filtering stale listing: ${listing.instanceId} (now owned by ${currentOwner.slice(0, 8)}..., not seller ${listing.sellerPubkey.slice(0, 8)}...)`,
        );
        return false;
      }

      // Check 2: If we have the seller's fleet data and it no longer contains
      // this aircraft, the seller already settled/scrapped it.
      const sellerAircraftIds = sellerFleets.get(listing.sellerPubkey);
      if (sellerAircraftIds && !sellerAircraftIds.has(listing.instanceId)) {
        logger.info(
          `Filtering stale listing: ${listing.instanceId} (seller ${listing.sellerPubkey.slice(0, 8)}... no longer owns it)`,
        );
        return false;
      }

      // Check 3: Unknown seller (no fleet data on this client) whose listing
      // is older than the unknown-seller TTL — we cannot verify ownership and
      // the listing is probably gone. Flag it so callers can filter; recent
      // listings from not-yet-loaded sellers stay unflagged.
      if (!sellerAircraftIds) {
        const ageSec = nowSec - (listing.createdAt ?? 0);
        if (ageSec > UNKNOWN_SELLER_STALE_TTL_SEC) {
          listing.staleUnknownSeller = true;
          staleUnknown += 1;
        }
      }

      return true;
    });
    const filtered = result.length;
    if (staleUnknown > 0) {
      logger.info(`Flagged ${staleUnknown} listing(s) from unknown sellers as stale.`);
    }
    if (filtered < listingsMap.size) {
      logger.info(
        `Filtered ${listingsMap.size - filtered} stale marketplace listing(s) via ownership verification.`,
      );
    }
  }

  result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  logger.info(`Returning ${result.length} unique marketplace listings.`);
  return result;
}
/**
 * Loads all active airlines from the global network.
 */
export async function loadGlobalAirlines(): Promise<never> {
  throw new Error("Snapshot loading is disabled for action-log worlds.");
}
