import { create } from "zustand";
import { useEngineStore } from "./engine.js";
import { createEngineSlice } from "./slices/engineSlice.js";
import { createFleetSlice } from "./slices/fleetSlice.js";
import { createIdentitySlice } from "./slices/identitySlice.js";
import { createNetworkSlice } from "./slices/networkSlice.js";
import { createWorldSlice } from "./slices/worldSlice.js";
import type { AirlineState } from "./types.js";

export * from "./types.js";

/**
 * AIRLINE STORE
 *
 * The main store for the player's airline.
 * Refactored into specialized slices for easier maintenance.
 */
export const useAirlineStore = create<AirlineState>()((...a) => ({
  ...createIdentitySlice(...a),
  ...createFleetSlice(...a),
  ...createNetworkSlice(...a),
  ...createEngineSlice(...a),
  ...createWorldSlice(...a),
}));

// --- Side Effects ---

// Automatically process fleet ticks when engine ticks advance.
// IMPORTANT: Only fire when the tick INTEGER changes, not on tickProgress
// sub-tick updates. The engine fires syncTick() every 1000ms but ticks only
// change every 3000ms, so without this guard we'd re-enter processTick and
// processGlobalTick ~3x per tick, causing duplicate event generation and
// competitor aircraft position flicker on the map.
let lastSubscribedTick = -1;
useEngineStore.subscribe((state) => {
  if (state.tick === lastSubscribedTick) return;
  lastSubscribedTick = state.tick;

  const store = useAirlineStore.getState();
  void store.processTick(state.tick);
  void store.processGlobalTick(state.tick);

  // Sync world state every 60 ticks (~3 mins)
  if (state.tick % 60 === 0) {
    store.syncWorld();
  }
});

// Initial world sync — retry if no competitors loaded (relay may not have
// connected yet on first attempt).
const INITIAL_SYNC_DELAY = 2000;
const RETRY_SYNC_DELAY = 5000;
const MAX_SYNC_RETRIES = 3;

(async () => {
  await new Promise((resolve) => setTimeout(resolve, INITIAL_SYNC_DELAY));

  for (let attempt = 0; attempt <= MAX_SYNC_RETRIES; attempt++) {
    await useAirlineStore.getState().syncWorld();
    const { competitors } = useAirlineStore.getState();
    if (competitors.size > 0) break;
    if (attempt < MAX_SYNC_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_SYNC_DELAY));
    }
  }
})();
