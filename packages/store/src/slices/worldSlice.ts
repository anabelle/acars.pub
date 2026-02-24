import { StateCreator } from 'zustand';
import { AirlineState } from '../types';
import { AirlineEntity, FlightOffer, Route, AircraftInstance } from '@airtr/core';
import { loadGlobalAirlines } from '@airtr/nostr';
import { getAircraftById } from '@airtr/data';

export interface WorldSlice {
    competitors: Map<string, AirlineEntity>;
    globalRouteRegistry: Map<string, FlightOffer[]>;
    syncWorld: () => Promise<void>;
}

export const createWorldSlice: StateCreator<
    AirlineState,
    [],
    [],
    WorldSlice
> = (set, get) => ({
    competitors: new Map(),
    globalRouteRegistry: new Map(),

    syncWorld: async () => {
        try {
            const results = await loadGlobalAirlines();
            const competitors = new Map<string, AirlineEntity>();
            const registry = new Map<string, FlightOffer[]>();

            // Process results into maps
            for (const { airline, fleet, routes } of results) {
                // Skip our own airline if it's in the global results
                if (airline.ceoPubkey === get().pubkey) continue;

                competitors.set(airline.ceoPubkey, airline);

                // For each route, create a FlightOffer
                for (const route of routes) {
                    if (route.status !== 'active') continue;

                    const key = `${route.originIata}-${route.destinationIata}`;
                    const offers = registry.get(key) || [];

                    // Calculate offer details
                    // Frequency is based on how many aircraft are assigned to this route
                    // If no aircraft assigned, it's effectively 0 frequency (or dummy 1 for now if we want to simulate)
                    // Let's assume each assigned aircraft flies 7 times a week for now to match engine logic
                    const frequency = route.assignedAircraftIds.length * 7;
                    if (frequency === 0) continue;

                    // Estimate travel time
                    let avgTravelTime = 0;
                    if (route.assignedAircraftIds.length > 0) {
                        const modelIds = route.assignedAircraftIds.map((id: string) => {
                            const ac = fleet.find((a: AircraftInstance) => a.id === id);
                            return ac?.modelId;
                        }).filter(Boolean);

                        const times = modelIds.map((mid: string | undefined) => {
                            const model = getAircraftById(mid!);
                            if (!model) return 480; // Default 8h
                            return (route.distanceKm / model.speedKmh) * 60;
                        });
                        avgTravelTime = times.reduce((a: number, b: number) => a + b, 0) / times.length;
                    }

                    const offer: FlightOffer = {
                        airlinePubkey: airline.ceoPubkey,
                        fareEconomy: route.fareEconomy,
                        fareBusiness: route.fareBusiness,
                        fareFirst: route.fareFirst,
                        frequencyPerWeek: frequency,
                        travelTimeMinutes: Math.round(avgTravelTime) || 480,
                        stops: 0, // Simplified for now
                        serviceScore: 0.7, // Manual override until cabin service logic is in
                        brandScore: airline.brandScore || 0.5,
                    };

                    offers.push(offer);
                    registry.set(key, offers);
                }
            }

            set({ competitors, globalRouteRegistry: registry });
        } catch (error) {
            console.error('[WorldSlice] Failed to sync world:', error);
        }
    }
});
