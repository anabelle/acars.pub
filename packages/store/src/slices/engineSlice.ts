import { StateCreator } from 'zustand';
import { AirlineState } from '../types';
import { processFlightEngine } from '../FlightEngine';
import { publishAirline } from '@airtr/nostr';
import { fpToNumber } from '@airtr/core';

export interface EngineSlice {
    processTick: (tick: number) => Promise<void>;
}

let isProcessing = false;

export const createEngineSlice: StateCreator<
    AirlineState,
    [],
    [],
    EngineSlice
> = (set, get) => ({
    processTick: async (tick: number) => {
        if (isProcessing) return;

        const { fleet, airline, routes } = get();
        if (!airline || airline.status === 'liquidated') return;

        // EMERGENCY BANKRUPTCY CHECK
        // If balance is severely negative (e.g. -$10M), auto-pause operations
        if (fpToNumber(airline.corporateBalance) < -10000000 && airline.status !== 'chapter11') {
            const updatedAirline = { ...airline, status: 'chapter11' as const };
            const previousState = { airline, fleet, routes, timeline: get().timeline };
            set({ airline: updatedAirline });
            publishAirline({ ...updatedAirline, fleet, routes })
                .catch(e => {
                    set(previousState);
                    console.error("Bankruptcy sync failed", e);
                });
            return;
        }

        // Prevent processing flights for a bankrupt airline
        if (airline.status === 'chapter11') return;

        // 1. Determine where we are vs where we need to be
        const lastTick = airline.lastTick ?? (tick - 1);

        // If we are already caught up, skip.
        if (lastTick >= tick) return;

        isProcessing = true;
        try {
            // 2. Catch up simulation
            // Safety cap: Never simulate more than 50,000 ticks (~40 hours) in one frame 
            // to avoid freezing the browser. If the jump is larger, we will catch up 
            // incrementally in subsequent frames until synchronized.
            const MAX_CATCHUP = 50000;
            const targetTick = Math.min(tick, lastTick + MAX_CATCHUP);

            let currentFleet = [...fleet];
            let currentBalance = airline.corporateBalance;
            let currentBrandScore = airline.brandScore || 0.5;
            let currentTimeline = [...get().timeline];
            let anyChanges = false;

            for (let t = lastTick + 1; t <= targetTick; t++) {
                const result = processFlightEngine(
                    t,
                    currentFleet,
                    routes,
                    currentBalance,
                    t - 1,
                    get().globalRouteRegistry,
                    get().pubkey || '',
                    currentBrandScore
                );
                currentFleet = result.updatedFleet;
                currentBalance = result.corporateBalance;

                if (result.events && result.events.length > 0) {
                    // Handle Price War Brand Damage
                    const pwEvents = result.events.filter(e => e.type === 'price_war');
                    if (pwEvents.length > 0) {
                        currentBrandScore = Math.max(0.1, currentBrandScore - (0.005 * pwEvents.length));
                        anyChanges = true;
                    }

                    console.log(`[EngineSlice] Tick ${t}: Captured ${result.events.length} events. Total timeline now: ${currentTimeline.length + result.events.length}`);
                    currentTimeline = [...result.events, ...currentTimeline].slice(0, 200);
                }

                if (result.hasChanges) anyChanges = true;
            }

            // 3. Update state - We move lastTick to targetTick (which might be less than global tick)
            const updatedAirline = {
                ...airline,
                corporateBalance: currentBalance,
                brandScore: currentBrandScore,
                lastTick: targetTick,
                timeline: currentTimeline
            };
            set({ fleet: currentFleet, airline: updatedAirline, timeline: currentTimeline });

            // 4. Sync to Nostr only if significant events happened
            if (anyChanges) {
                publishAirline({
                    ...updatedAirline,
                    fleet: currentFleet,
                    routes
                }).catch(e => console.error("Auto-sync tick failed", e));
            }
        } finally {
            isProcessing = false;
        }
    },
});
