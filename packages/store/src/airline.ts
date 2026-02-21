import { create } from 'zustand';
import type { AirlineEntity } from '@airtr/core';
import { fp } from '@airtr/core';
import {
    waitForNip07,
    getPubkey,
    attachSigner,
    ensureConnected,
    loadAirline,
    publishAirline,
    type AirlineConfig
} from '@airtr/nostr';

/**
 * User paths:
 * 
 * 1. No NIP-07 extension → show "Install Extension" message, can't play
 * 2. Extension present, first visit → getPubkey() → no airline found → show Create form
 * 3. Extension present, return visit → getPubkey() → load airline → show dashboard
 * 4. Extension present, switch identity → reload → getPubkey() returns NEW pubkey → load THAT airline
 * 
 * Key invariant: we ALWAYS ask window.nostr.getPublicKey() fresh on each init.
 * We never cache the pubkey ourselves. The extension is the source of truth.
 */

export type IdentityStatus = 'checking' | 'no-extension' | 'ready';

export interface AirlineState {
    airline: AirlineEntity | null;
    pubkey: string | null;
    identityStatus: IdentityStatus;
    isLoading: boolean;
    error: string | null;

    // Actions
    initializeIdentity: () => Promise<void>;
    createAirline: (params: AirlineConfig) => Promise<void>;
    updateHub: (newHubIata: string) => Promise<void>;
}

export const useAirlineStore = create<AirlineState>((set, get) => ({
    airline: null,
    pubkey: null,
    identityStatus: 'checking',
    isLoading: false,
    error: null,

    initializeIdentity: async () => {
        set({ isLoading: true, error: null, airline: null, pubkey: null });

        // Step 1: Wait for NIP-07 extension to inject (up to 1.5s)
        const extensionReady = await waitForNip07();
        if (!extensionReady) {
            set({ identityStatus: 'no-extension', isLoading: false });
            return;
        }

        try {
            // Step 2: Get pubkey from extension (fresh every time — no caching)
            const pubkey = await getPubkey();

            if (!pubkey) {
                set({ identityStatus: 'no-extension', isLoading: false, error: 'Extension did not return a pubkey' });
                return;
            }

            // Step 3: Attach signer to NDK (fresh instance to avoid cached identity)
            attachSigner();

            // Step 4: Start relay connections (fire-and-forget, NDK handles reconnection)
            ensureConnected();

            // Step 5: Try to load existing airline for this pubkey
            const existing = await loadAirline(pubkey);

            set({
                pubkey,
                airline: existing,
                identityStatus: 'ready',
                isLoading: false,
            });
        } catch (error: any) {
            set({
                error: error.message,
                identityStatus: 'ready', // Extension works, just failed to load
                isLoading: false,
            });
        }
    },

    createAirline: async (params) => {
        set({ isLoading: true, error: null });
        try {
            // Ensure signer is attached and relays connected
            attachSigner();
            ensureConnected();

            await publishAirline(params);

            // Get current pubkey (should already be known)
            const pubkey = await getPubkey();
            if (!pubkey) throw new Error('Lost identity during publish');

            const newAirline: AirlineEntity = {
                id: pubkey, // We'll just use pubkey as ID for the MVP store testing locally
                foundedBy: pubkey,
                status: 'private',
                ceoPubkey: pubkey,
                sharesOutstanding: 10000000,
                shareholders: { [pubkey]: 10000000 },
                ...params,
                brandScore: 0.5,
                tier: 1,
                corporateBalance: fp(100000000),
                stockPrice: fp(10),
                fleetIds: [],
                routeIds: []
            };

            set({ airline: newAirline, pubkey, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    updateHub: async (newHubIata: string) => {
        const { airline } = get();
        if (!airline) return;

        const updated = { ...airline, hubs: [newHubIata] };
        set({ airline: updated });

        // Republish to Nostr so the hub change persists
        try {
            attachSigner();
            ensureConnected();
            await publishAirline({
                name: updated.name,
                icaoCode: updated.icaoCode,
                callsign: updated.callsign,
                hubs: updated.hubs,
                livery: updated.livery,
            });
        } catch (error: any) {
            console.warn('Failed to publish hub change to Nostr:', error);
            // Optimistic update already applied — will sync next publish
        }
    },
}));
