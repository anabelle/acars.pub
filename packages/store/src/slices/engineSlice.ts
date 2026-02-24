import { StateCreator } from 'zustand';
import { AirlineState } from '../types';
import { processFlightEngine } from '../FlightEngine';
import { publishAirline } from '@airtr/nostr';

export interface EngineSlice {
    processTick: (tick: number) => Promise<void>;
}

export const createEngineSlice: StateCreator<
    AirlineState,
    [],
    [],
    EngineSlice
> = (set, get) => ({
    processTick: async (tick: number) => {
        const { fleet, airline, routes } = get();
        if (!airline) return;

        const { updatedFleet, corporateBalance, hasChanges } = processFlightEngine(
            tick,
            fleet,
            routes,
            airline.corporateBalance
        );

        const updatedAirline = { ...airline, corporateBalance, lastTick: tick };
        set({ fleet: updatedFleet, airline: updatedAirline });

        if (hasChanges) {
            publishAirline({
                ...updatedAirline,
                fleet: updatedFleet,
                routes
            }).catch(e => console.error("Auto-sync tick failed", e));
        }
    },
});
