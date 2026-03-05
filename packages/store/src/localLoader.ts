import { type Checkpoint, decompressSnapshotString, fpAdd } from "@acars/core";
import { loadSnapshot } from "@acars/nostr";
import { db } from "./db.js";
import { reconcileFleetToTick } from "./FlightEngine.js";
import { useEngineStore } from "./engine.js";
import type { AirlineState } from "./types.js";

const MAX_PLAYER_CATCHUP = 50000;

export async function hydrateIdentityFromStorage(
  pubkey: string,
  set: (state: Partial<AirlineState>) => void,
) {
  // 1. Load instantly from IndexedDB
  const localAirline = await db.airline.get(pubkey);
  const localFleet = await db.fleet.where({ ownerPubkey: pubkey }).toArray();
  const localRoutes = await db.routes.where({ airlinePubkey: pubkey }).toArray();

  // Apply immediately for instant loading
  if (localAirline) {
    set({
      airline: localAirline,
      fleet: localFleet,
      routes: localRoutes,
      timeline: localAirline.timeline || [],
      // Re-trigger loading state off while we fetch from Nostr quietly
      identityStatus: "ready",
      isLoading: false,
    });
  }

  // 2. Background sync with Nostr NIP-33 Snapshot Rollups
  try {
    const remote = await loadSnapshot(pubkey);
    if (remote) {
      const decompressedString = await decompressSnapshotString(remote.compressedData);
      const snapshotCheckpoint = JSON.parse(decompressedString) as Checkpoint;

      const localTick = localAirline?.lastTick ?? 0;

      // If remote is newer, replace local
      if (snapshotCheckpoint.tick > localTick) {
        console.log(
          `[Identity] Nostr snapshot tick ${snapshotCheckpoint.tick} is newer than local DB ${localTick}. Overwriting state.`,
        );
        const { airline, fleet, routes, timeline, actionChainHash } = snapshotCheckpoint;

        await db.airline.put(airline);
        await Promise.all(fleet.map((f) => db.fleet.put(f)));
        await Promise.all(routes.map((r) => db.routes.put(r)));

        set({
          airline,
          fleet,
          routes,
          timeline,
          actionChainHash,
          latestCheckpoint: snapshotCheckpoint,
        });
      }
    }
  } catch (err) {
    console.error("[Identity] Failed to sync remote snapshot:", err);
  }

  // 3. Reconcile loaded state (catchup)
  // Wait for the state to settle before reading it out to reconcile
  const finalState = await new Promise<{
    airline: import("@acars/core").AirlineEntity;
    fleet: import("@acars/core").AircraftInstance[];
    routes: import("@acars/core").Route[];
  } | null>((resolve) =>
    setTimeout(() => {
      db.airline.get(pubkey).then((finalAirline) => {
        if (!finalAirline) resolve(null);
        else {
          Promise.all([
            db.fleet.where({ ownerPubkey: pubkey }).toArray(),
            db.routes.where({ airlinePubkey: pubkey }).toArray(),
          ]).then(([f, r]) => {
            resolve({ airline: finalAirline, fleet: f, routes: r });
          });
        }
      });
    }, 0),
  );

  if (!finalState) {
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
    return;
  }

  const { airline, routes } = finalState;
  let { fleet } = finalState;
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

  if (airline.lastTick != null && fleet.length > 0) {
    const { fleet: reconciled, balanceDelta } = reconcileFleetToTick(
      fleet,
      routes,
      airline.lastTick,
    );
    fleet = reconciled;
    airline.corporateBalance = fpAdd(airline.corporateBalance, balanceDelta);
  }

  set({
    pubkey,
    airline,
    fleet,
    routes,
    timeline: airline.timeline || [],
    fleetDeletedDuringCatchup: [],
    identityStatus: "ready",
    isLoading: false,
  });
}
