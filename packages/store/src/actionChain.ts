import {
  type GameActionEnvelope,
  type Checkpoint,
  computeCheckpointStateHash,
  compressSnapshotString,
} from "@acars/core";
import { type NDKEvent, publishAction, publishSnapshot } from "@acars/nostr";
import type { AirlineState } from "./types.js";
import { enqueueSerialUpdate } from "./utils/asyncQueue.js";
import { useEngineStore } from "./engine.js";
import { replayActionLog } from "./actionReducer.js";
import { db } from "./db.js";

export async function publishActionWithChain(params: {
  action: GameActionEnvelope;
  get: () => AirlineState;
  set: (state: Partial<AirlineState>) => void;
}): Promise<NDKEvent> {
  const { action, get, set } = params;
  const state = get();

  const seq = state.actionSeq;
  set({ actionSeq: seq + 1 });

  const event = await publishAction(action, seq);

  await enqueueSerialUpdate(async () => {
    const currentState = get();
    // 1. Locally apply the action to pseudo-checkpoint
    const pseudoCheckpoint: Checkpoint = {
      schemaVersion: 1,
      tick: useEngineStore.getState().tick,
      createdAt: Date.now(),
      actionChainHash: currentState.actionChainHash,
      stateHash: currentState.latestCheckpoint?.stateHash || "",
      airline: currentState.airline!,
      fleet: currentState.fleet,
      routes: currentState.routes,
      timeline: currentState.timeline,
    };

    const replayed = await replayActionLog({
      pubkey: currentState.pubkey || event.author.pubkey,
      actions: [
        {
          action,
          eventId: event.id,
          authorPubkey: event.author.pubkey,
          createdAt: event.created_at ?? null,
        },
      ],
      checkpoint: pseudoCheckpoint,
      rejectedEventIds: new Set(),
    });

    // 2. update Zustand
    set({
      airline: replayed.airline,
      fleet: replayed.fleet,
      routes: replayed.routes,
      timeline: replayed.timeline,
      actionChainHash: replayed.actionChainHash,
    });

    // 3. update IndexedDB
    if (replayed.airline) {
      await db.airline.put(replayed.airline);
    }
    // Simple naive update for the active arrays
    await Promise.all(replayed.fleet.map((f) => db.fleet.put(f)));
    await Promise.all(replayed.routes.map((r) => db.routes.put(r)));

    // 4. trigger NIP-33 snapshot (background)
    publishCurrentStateSnapshot(get()).catch(console.error);
  });

  return event;
}

export async function publishCurrentStateSnapshot(state: AirlineState) {
  if (!state.airline) return;
  const tick = useEngineStore.getState().tick;
  const stateHash = await computeCheckpointStateHash({
    airline: state.airline,
    fleet: state.fleet,
    routes: state.routes,
    timeline: state.timeline,
  });
  const payload = {
    schemaVersion: 1,
    tick,
    createdAt: Date.now(),
    actionChainHash: state.actionChainHash,
    stateHash,
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
}
