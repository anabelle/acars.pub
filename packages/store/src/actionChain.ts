import {
  type GameActionEnvelope,
  type Checkpoint,
  computeCheckpointStateHash,
  compressSnapshotString,
} from "@acars/core";
import { type ActionLogEntry, type NDKEvent, publishAction, publishSnapshot } from "@acars/nostr";
import type { AirlineState } from "./types.js";
import { enqueueSerialUpdate } from "./utils/asyncQueue.js";
import { useEngineStore } from "./engine.js";
import { replayActionLog } from "./actionReducer.js";
import { computeRejectedBuyEventIds } from "./marketplaceReplay.js";
import { db } from "./db.js";
import { dequeueOutbox, enqueueOutbox, storageAvailable } from "./outbox.js";

const actionSeqKey = (pubkey: string) => `actionSeq:${pubkey}`;

export async function publishActionWithChain(params: {
  action: GameActionEnvelope;
  get: () => AirlineState;
  set: (state: Partial<AirlineState>) => void;
}): Promise<NDKEvent> {
  const { action, get, set } = params;
  const state = get();

  if (!state.airline) {
    throw new Error("Cannot publish action: no airline exists. Create an airline first.");
  }

  // Capture pre-action baseline for deterministic replay
  const baselineCheckpoint: Checkpoint = {
    schemaVersion: 1,
    tick: useEngineStore.getState().tick,
    createdAt: Date.now(),
    actionChainHash: state.actionChainHash,
    stateHash: state.latestCheckpoint?.stateHash || "",
    airline: state.airline,
    fleet: state.fleet,
    routes: state.routes,
    timeline: state.timeline,
  };

  const seq = state.actionSeq;
  set({ actionSeq: seq + 1 });

  // Outbox + publish + replay all run on the same serialized queue so the
  // order of persisted intents matches the order of published events.
  let publishedEvent: NDKEvent | null = null;

  await enqueueSerialUpdate(async () => {
    const authorPubkey = get().pubkey || "";

    // 1. Persist the intent BEFORE publishing — if the tab dies or the
    //    relay is down mid-publish, flushOutbox() re-sends it on next boot.
    // Skipped synchronously (no await) when storage is unavailable so the
    // publish call is not deferred behind a promise hop.
    let outboxId: number | undefined;
    if (storageAvailable()) {
      try {
        outboxId = await enqueueOutbox({
          createdAt: Date.now(),
          pubkey: authorPubkey,
          seq,
          action,
        });
      } catch (e) {
        console.warn("[ActionChain] Failed to persist outbox entry", e);
      }
    }

    // 2. Publish (entry stays in the outbox on failure for later retry).
    const event = await publishAction(action, seq);
    if (outboxId != null) {
      await dequeueOutbox(outboxId).catch((e) =>
        console.warn("[ActionChain] Failed to clear outbox entry", e),
      );
    }
    publishedEvent = event;

    // 3. The applicable action log for the anti-double-purchase guard is
    //    the newly published event plus any of our still-pending outbox
    //    actions (an unpublished AIRCRAFT_BUY_USED for the same instance
    //    must reject the new buy exactly like a relay-side duplicate would).
    let pendingOutboxLog: ActionLogEntry[] = [];
    try {
      const pending = storageAvailable() ? await db.outbox.toArray() : [];
      pendingOutboxLog = pending
        .filter((entry) => entry.pubkey === authorPubkey)
        .map((entry) => ({
          event: {
            id: `outbox:${entry.id}`,
            created_at: Math.floor(entry.createdAt / 1000),
          },
          action: entry.action,
        })) as unknown as ActionLogEntry[];
    } catch {
      // Outbox unavailable — guard on the published event alone.
    }
    const rejectedEventIds = computeRejectedBuyEventIds([
      ...pendingOutboxLog,
      {
        event: { id: event.id, created_at: event.created_at ?? null },
        action,
      } as unknown as ActionLogEntry,
    ]);

    // Replay from the committed baseline, not live store
    const replayed = await replayActionLog({
      pubkey: get().pubkey || event.author.pubkey,
      actions: [
        {
          action,
          eventId: event.id,
          authorPubkey: event.author.pubkey,
          createdAt: event.created_at ?? null,
        },
      ],
      checkpoint: baselineCheckpoint,
      rejectedEventIds,
    });

    // Update Zustand
    set({
      airline: replayed.airline,
      fleet: replayed.fleet,
      routes: replayed.routes,
      timeline: replayed.timeline,
      actionChainHash: replayed.actionChainHash,
    });

    // Update IndexedDB — transactional replace by owner. Best-effort: a
    // storage failure here (quota, private mode, missing API) must not
    // reject the task after a successful publish — the Nostr log is the
    // source of truth and the next hydrate/snapshot will re-derive.
    if (replayed.airline) {
      const airline = replayed.airline;
      const ownerPubkey = airline.ceoPubkey;
      try {
        if (storageAvailable()) {
          await db.transaction("rw", db.airline, db.fleet, db.routes, async () => {
            await db.airline.put(airline);
            await db.fleet.where({ ownerPubkey }).delete();
            await db.routes.where({ airlinePubkey: ownerPubkey }).delete();
            if (replayed.fleet.length > 0) await db.fleet.bulkPut(replayed.fleet);
            if (replayed.routes.length > 0) await db.routes.bulkPut(replayed.routes);
          });
        }
      } catch (e) {
        console.warn("[ActionChain] Failed to persist replayed state to Dexie", e);
      }
      // Persist the action counter so the next hydrate restores a
      // monotonic seq (feeds deterministic instance/route id generation).
      if (authorPubkey && storageAvailable()) {
        await db.meta
          .put({ key: actionSeqKey(authorPubkey), value: seq + 1 })
          .catch((e) => console.warn("[ActionChain] Failed to persist actionSeq", e));
      }
    }

    // Trigger NIP-33 snapshot (background)
    publishCurrentStateSnapshot(get(), set).catch(console.error);
  });

  return publishedEvent as NDKEvent;
}

export async function publishCurrentStateSnapshot(
  state: AirlineState,
  set?: (state: Partial<AirlineState>) => void,
): Promise<void> {
  if (!state.airline) return;
  const tick = useEngineStore.getState().tick;
  const stateHash = await computeCheckpointStateHash({
    airline: state.airline,
    fleet: state.fleet,
    routes: state.routes,
    timeline: state.timeline,
  });
  const createdAt = Date.now();
  const payload = {
    schemaVersion: 1,
    tick,
    createdAt,
    actionChainHash: state.actionChainHash,
    stateHash,
    // Persisted so hydrateIdentityFromStorage can restore a monotonic
    // actionSeq across restarts (max with the local Dexie meta value).
    actionSeq: state.actionSeq,
    airline: state.airline,
    fleet: state.fleet,
    routes: state.routes,
    timeline: state.timeline,
  };
  const str = JSON.stringify(payload);
  const compressedData = await compressSnapshotString(str);
  await publishSnapshot({
    compressedData,
    stateHash,
    tick,
  });

  // Track the last successfully published checkpoint so the next baseline
  // checkpoint carries a real stateHash instead of "".
  const checkpoint: Checkpoint = {
    schemaVersion: 1,
    tick,
    createdAt,
    actionChainHash: state.actionChainHash,
    stateHash,
    airline: state.airline,
    fleet: state.fleet,
    routes: state.routes,
    timeline: state.timeline,
  };
  set?.({ latestCheckpoint: checkpoint });
  if (state.pubkey && storageAvailable()) {
    await db.meta
      .put({ key: actionSeqKey(state.pubkey), value: state.actionSeq })
      .catch(() => undefined);
  }
}
