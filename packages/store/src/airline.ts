import { create } from 'zustand';
import type { AirlineState } from './types.js';
import { createIdentitySlice } from './slices/identitySlice.js';
import { createFleetSlice } from './slices/fleetSlice.js';
import { createNetworkSlice } from './slices/networkSlice.js';
import { createEngineSlice } from './slices/engineSlice.js';
import { createWorldSlice } from './slices/worldSlice.js';
import { useEngineStore } from './engine.js';

export * from './types.js';

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

// Automatically process fleet ticks when engine ticks advance
useEngineStore.subscribe((state) => {
    const store = useAirlineStore.getState();
    store.processTick(state.tick);

    // Sync world state every 60 ticks (~3 mins)
    if (state.tick % 60 === 0) {
        store.syncWorld();
    }
});

// Initial world sync
setTimeout(() => {
    useAirlineStore.getState().syncWorld();
}, 2000);
