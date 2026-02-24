import { StateCreator } from 'zustand';
import { AirlineState } from '../types';
import { Route, fpSub, fp } from '@airtr/core';
import { getAircraftById } from '@airtr/data';
import { publishAirline } from '@airtr/nostr';
import { useEngineStore } from '../engine';

export interface NetworkSlice {
    routes: Route[];
    updateHub: (newHubIata: string) => Promise<void>;
    openRoute: (originIata: string, destinationIata: string, distanceKm: number) => Promise<void>;
    assignAircraftToRoute: (aircraftId: string, routeId: string | null) => Promise<void>;
}

export const createNetworkSlice: StateCreator<
    AirlineState,
    [],
    [],
    NetworkSlice
> = (set, get) => ({
    routes: [],

    updateHub: async (targetHubIata: string) => {
        const { airline, fleet, routes } = get();
        if (!airline) return;

        const updatedAirline = {
            ...airline,
            hubs: [targetHubIata]
        };

        set({ airline: updatedAirline });

        try {
            await publishAirline({
                name: updatedAirline.name,
                icaoCode: updatedAirline.icaoCode,
                callsign: updatedAirline.callsign,
                hubs: updatedAirline.hubs,
                livery: updatedAirline.livery,
                corporateBalance: updatedAirline.corporateBalance,
                fleet: fleet,
                routes: routes,
                lastTick: useEngineStore.getState().tick,
            });
        } catch (error: any) {
            console.warn('Failed to publish hub change to Nostr:', error);
        }
    },

    openRoute: async (originIata: string, destinationIata: string, distanceKm: number) => {
        const { airline, routes, fleet, pubkey } = get();
        if (!airline || !pubkey) throw new Error("No airline loaded.");

        const SLOT_FEE = fp(100000);
        if (airline.corporateBalance < SLOT_FEE) {
            throw new Error("Insufficient funds to open route. Cost: $100,000");
        }

        const newRoute: Route = {
            id: `rt-${Date.now().toString(36)}`,
            originIata,
            destinationIata,
            airlinePubkey: pubkey,
            distanceKm,
            assignedAircraftIds: [],
            fareEconomy: fp(Math.round(distanceKm * 0.15 + 50)),
            fareBusiness: fp(Math.round(distanceKm * 0.4 + 150)),
            fareFirst: fp(Math.round(distanceKm * 0.8 + 400)),
            status: 'active',
        };

        const updatedAirline = {
            ...airline,
            corporateBalance: fpSub(airline.corporateBalance, SLOT_FEE),
            routeIds: [...airline.routeIds, newRoute.id]
        };

        const updatedRoutes = [...routes, newRoute];

        set({ airline: updatedAirline, routes: updatedRoutes });

        try {
            await publishAirline({
                ...updatedAirline,
                fleet,
                routes: updatedRoutes,
                lastTick: useEngineStore.getState().tick,
            });
        } catch (e) {
            console.error("Failed to sync route to Nostr:", e);
        }
    },

    assignAircraftToRoute: async (aircraftId: string, routeId: string | null) => {
        const { fleet, routes, airline } = get();

        const aircraft = fleet.find(ac => ac.id === aircraftId);
        const route = routes.find(r => r.id === routeId);

        if (aircraft && route) {
            const model = getAircraftById(aircraft.modelId);
            if (model && route.distanceKm > (model.rangeKm || 0)) {
                throw new Error(`${aircraft.name} does not have enough range for this route.`);
            }
        }

        const updatedFleet = fleet.map(ac => {
            if (ac.id === aircraftId) {
                return { ...ac, assignedRouteId: routeId };
            }
            return ac;
        });

        const updatedRoutes = routes.map(rt => {
            const assigned = rt.assignedAircraftIds.filter(id => id !== aircraftId);
            if (rt.id === routeId) {
                assigned.push(aircraftId);
            }
            return { ...rt, assignedAircraftIds: assigned };
        });

        set({ fleet: updatedFleet, routes: updatedRoutes });

        if (airline) {
            try {
                await publishAirline({
                    ...airline,
                    fleet: updatedFleet,
                    routes: updatedRoutes,
                    lastTick: useEngineStore.getState().tick
                });
            } catch (e) {
                console.error("Failed to sync assignment to Nostr:", e);
            }
        }
    },
});
