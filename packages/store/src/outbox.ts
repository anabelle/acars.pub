import { createLogger } from "@acars/core";
import { publishAction } from "@acars/nostr";
import { db, type OutboxRecord } from "./db.js";

const logger = createLogger("Outbox");

/** Entries older than this are considered permanently stale and dropped. */
export const OUTBOX_MAX_AGE_MS = 24 * 60 * 60 * 1000;

let flushInFlight: Promise<void> | null = null;

/**
 * Synchronous availability probe. Dexie's failure mode when IndexedDB is
 * missing (node tests, SSR) is an ASYNC rejection that rides the DB-open
 * macrotask cycle — awaiting it before the publish call would push the
 * publish itself past the test's assertion point (and add pointless
 * latency in production when storage is blocked). Checking the global
 * synchronously keeps the hot path macrotask-free.
 */
export function storageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/**
 * Persist an action to the outbox BEFORE it is published, so a crash or
 * relay outage mid-publish cannot silently lose the intent. Called on the
 * same serialized queue as the publish itself (see actionChain.ts).
 * Returns undefined when persistence is unavailable (no IndexedDB).
 */
export async function enqueueOutbox(record: Omit<OutboxRecord, "id">): Promise<number | undefined> {
  if (!storageAvailable()) return undefined;
  return await db.outbox.add(record as OutboxRecord);
}

/** Remove an outbox entry after its publish succeeded. */
export async function dequeueOutbox(id: number): Promise<void> {
  if (!storageAvailable()) return;
  await db.outbox.delete(id);
}

/**
 * Re-send outbox entries that never got published (e.g. the tab was closed
 * while a relay was down). Re-publishing an action that actually landed is
 * harmless: relays deduplicate by event id where identical, and the replay
 * reducer is idempotent per entity id (purchases/route opens guard on
 * already-known ids). Entries older than OUTBOX_MAX_AGE_MS are dropped.
 */
export async function flushOutbox(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  if (!storageAvailable()) return;
  flushInFlight = (async () => {
    let entries: OutboxRecord[] = [];
    try {
      entries = await db.outbox.toArray();
    } catch (e) {
      logger.warn("Failed to read outbox", e);
      return;
    }
    if (entries.length === 0) return;

    const now = Date.now();
    for (const entry of entries) {
      if (entry.id == null) continue;
      if (now - entry.createdAt > OUTBOX_MAX_AGE_MS) {
        await db.outbox.delete(entry.id).catch(() => undefined);
        logger.warn(`Dropped stale outbox entry (age ${now - entry.createdAt}ms)`);
        continue;
      }
      try {
        await publishAction(entry.action, entry.seq);
        await db.outbox.delete(entry.id);
        logger.info(`Re-sent pending action from outbox (${entry.action.action})`);
      } catch (e) {
        // Still failing (e.g. relays down) — keep the entry for the next boot.
        logger.warn(`Outbox re-send failed for ${entry.action.action}`, e);
      }
    }
  })();
  try {
    await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}
