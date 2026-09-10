import { type Checkpoint, fpAdd } from "@acars/core";
import { loadSnapshot } from "@acars/nostr";
import { db } from "./db.js";
import { useEngineStore } from "./engine.js";
import { reconcileFleetToTick } from "./FlightEngine.js";
import { flushOutbox } from "./outbox.js";
import { verifySnapshotPayload } from "./snapshotValidation.js";
import type { AirlineState } from "./types.js";

const MAX_PLAYER_CATCHUP = 50000;

const actionSeqKey = (pubkey: string) => `actionSeq:${pubkey}`;

/**
 * Loads and reconciles identity state from local storage and snapshots.
 */
export async function hydrateIdentityFromStorage(
  pubkey: string,
  set: (state: Partial<AirlineState>) => void,
) {
  // 1. Load instantly from IndexedDB
  const localAirline = await db.airline.where({ ceoPubkey: pubkey }).first();
  const localFleet = await db.fleet.where({ ownerPubkey: pubkey }).toArray();
  const localRoutes = await db.routes.where({ airlinePubkey: pubkey }).toArray();

  let currentAirline = localAirline ?? null;
  let currentFleet = localFleet;
  let currentRoutes = localRoutes;
  let currentActionChainHash = "";
  let currentLatestCheckpoint: Checkpoint | null = null;
  // Restored from the persisted snapshot payload and/or the local meta
  // table (see actionChain.ts) — never reset to 0 blindly, because
  // actionSeq feeds deterministic instance/route id generation.
  let currentActionSeq = 0;
  try {
    const meta = await db.meta.get(actionSeqKey(pubkey));
    if (meta && meta.value > currentActionSeq) currentActionSeq = meta.value;
  } catch {
    // meta table unavailable — fall back to snapshot-restored seq only
  }

  // 2. Background sync with Nostr NIP-33 Snapshot Rollups
  try {
    const remote = await loadSnapshot(pubkey);
    if (remote) {
      // LWW-by-tick, but a remote snapshot only wins if it VERIFIES:
      // parseCheckpoint shape validation + recomputed state hash must
      // match both the checkpoint body and the relay payload hash, and
      // the defensive fleet/balance clamps must hold. If verification
      // fails we keep local state (which may contain actions applied
      // after the peer's last snapshot that the hash chain can't see).
      //
      // REMAINING LIMITATION (accepted, minimal fix): when both sides
      // verify there is still no real merge — a verified remote tick
      // strictly greater than local replaces local wholesale, so any
      // local actions newer than the remote snapshot are lost until the
      // next snapshot publish. A proper three-way merge over the shared
      // action log is future work.
      const snapshotCheckpoint = await verifySnapshotPayload(remote);
      const localTick = currentAirline?.lastTick ?? 0;

      if (snapshotCheckpoint && snapshotCheckpoint.tick > localTick) {
        console.log(
          `[Identity] Verified Nostr snapshot tick ${snapshotCheckpoint.tick} is newer than local DB ${localTick}. Overwriting state.`,
        );
        const { airline, fleet, routes, actionChainHash } = snapshotCheckpoint;

        // Transactional replace: clear existing records for this owner then write snapshot
        await db.transaction("rw", db.airline, db.fleet, db.routes, async () => {
          await db.airline.where({ ceoPubkey: pubkey }).delete();
          await db.fleet.where({ ownerPubkey: pubkey }).delete();
          await db.routes.where({ airlinePubkey: pubkey }).delete();
          await db.airline.put(airline);
          if (fleet.length > 0) await db.fleet.bulkPut(fleet);
          if (routes.length > 0) await db.routes.bulkPut(routes);
        });

        currentAirline = airline;
        currentFleet = fleet;
        currentRoutes = routes;
        currentActionChainHash = actionChainHash;
        currentLatestCheckpoint = snapshotCheckpoint;
        // Restore the persisted actionSeq (field added to snapshot payloads
        // by publishCurrentStateSnapshot). max(persisted, local-meta) keeps
        // the seq monotonic across restarts.
        const persistedSeq = (snapshotCheckpoint as Checkpoint & { actionSeq?: unknown }).actionSeq;
        if (typeof persistedSeq === "number" && Number.isFinite(persistedSeq)) {
          currentActionSeq = Math.max(currentActionSeq, Math.floor(persistedSeq));
        }
      } else if (snapshotCheckpoint === null && remote.tick > localTick) {
        console.warn(
          `[Identity] Remote snapshot tick ${remote.tick} failed verification — keeping local state.`,
        );
      }
    }
  } catch (err) {
    console.error("[Identity] Failed to sync remote snapshot:", err);
  }

  // 3. Reconcile loaded state (catchup)
  if (!currentAirline) {
    set({
      pubkey,
      airline: null,
      fleet: [],
      routes: [],
      timeline: [],
      actionChainHash: "",
      actionSeq: 0,
      fleetDeletedDuringCatchup: [],
      latestCheckpoint: null,
      identityStatus: "ready",
      isLoading: false,
    });
    void flushOutbox().catch((e) => console.warn("[Identity] Outbox flush failed", e));
    return;
  }

  const airline = { ...currentAirline };
  let fleet = currentFleet;
  const routes = currentRoutes;
  const engineTick = useEngineStore.getState().tick;

  if (
    (airline.lastTick == null || airline.lastTick === 0) &&
    (fleet.length > 0 || routes.length > 0)
  ) {
    airline.lastTick = Math.max(0, engineTick - MAX_PLAYER_CATCHUP);
  } else if (airline.lastTick != null) {
    const oldestAllowedTick = Math.max(0, engineTick - MAX_PLAYER_CATCHUP);
    if (airline.lastTick < oldestAllowedTick) {
      airline.lastTick = oldestAllowedTick;
    }
  }

  // Reconcile to the current engine tick, not the snapshot's lastTick
  let reconciledTimeline = airline.timeline || [];
  if (airline.lastTick != null && fleet.length > 0 && engineTick > airline.lastTick) {
    const {
      fleet: reconciled,
      events,
      balanceDelta,
    } = reconcileFleetToTick(fleet, routes, engineTick);
    fleet = reconciled;
    airline.lastTick = engineTick;
    airline.corporateBalance = fpAdd(airline.corporateBalance, balanceDelta);

    // Merge synthetic takeoff/landing events into the timeline so the
    // activity log reflects what happened while the client was offline.
    if (events.length > 0) {
      const existingIds = new Set(reconciledTimeline.map((e) => e.id));
      const newEvents = events.filter((e) => !existingIds.has(e.id));
      if (newEvents.length > 0) {
        reconciledTimeline = [...newEvents, ...reconciledTimeline].slice(0, 1000);
        airline.timeline = reconciledTimeline;
      }
    }
  }

  set({
    pubkey,
    airline,
    fleet,
    routes,
    timeline: reconciledTimeline,
    actionChainHash: currentActionChainHash,
    actionSeq: currentActionSeq,
    latestCheckpoint: currentLatestCheckpoint,
    fleetDeletedDuringCatchup: [],
    identityStatus: "ready",
    isLoading: false,
  });

  // Re-send any actions that were persisted to the outbox but never
  // successfully published before the app closed (< 24h old).
  void flushOutbox().catch((e) => console.warn("[Identity] Outbox flush failed", e));
}
