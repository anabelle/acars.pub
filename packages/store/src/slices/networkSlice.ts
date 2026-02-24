import type { StateCreator } from 'zustand';
import type { AirlineState } from '../types';
import type { Route, FixedPoint, TimelineEvent } from '@airtr/core';
import { fpSub, fp, GENESIS_TIME, TICK_DURATION, fpFormat, getSuggestedFares } from '@airtr/core';
import { getAircraftById } from '@airtr/data';
import { airports } from '@airtr/data';
import { publishAirline } from '@airtr/nostr';
import { useEngineStore } from '../engine';

export type HubAction =
    | { type: 'add'; iata: string }
    | { type: 'switch'; iata: string }
    | { type: 'remove'; iata: string };

export interface NetworkSlice {
    routes: Route[];
    modifyHubs: (action: HubAction) => Promise<void>;
    /** @deprecated Use modifyHubs instead */
    updateHub: (newHubIata: string) => Promise<void>;
    openRoute: (originIata: string, destinationIata: string, distanceKm: number) => Promise<void>;
    assignAircraftToRoute: (aircraftId: string, routeId: string | null) => Promise<void>;
    updateRouteFares: (routeId: string, fares: { economy?: FixedPoint; business?: FixedPoint; first?: FixedPoint }) => Promise<void>;
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

        const currentTimeline = [...get().timeline];
        const currentTick = useEngineStore.getState().tick;
        const simulatedTimestamp = GENESIS_TIME + (currentTick * TICK_DURATION);

        const newEvent: TimelineEvent = {
            id: `evt-hub-${targetHubIata}-${currentTick}`,
            tick: currentTick,
            timestamp: simulatedTimestamp,
            type: 'delivery',
            description: `Transferred main operations hub to ${targetHubIata}.`
        };

        const finalTimeline = [newEvent, ...currentTimeline].slice(0, 200);

        const updatedHubs = Array.from(new Set([targetHubIata, ...(airline.hubs || [])]));
        const updatedAirline = {
            ...airline,
            hubs: updatedHubs,
            timeline: finalTimeline
        };

        const previousState = { airline, fleet, routes, timeline: get().timeline };

        set({
            airline: updatedAirline,
            timeline: finalTimeline
        });

        try {
            await publishAirline({
                ...updatedAirline,
                fleet: fleet,
                routes: routes,
                timeline: finalTimeline,
                lastTick: currentTick,
            });
        } catch (error: any) {
            set(previousState);
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

        const suggested = getSuggestedFares(distanceKm);

        const newRoute: Route = {
            id: `rt-${Date.now().toString(36)}`,
            originIata,
            destinationIata,
            airlinePubkey: pubkey,
            distanceKm,
            assignedAircraftIds: [],
            fareEconomy: suggested.economy,
            fareBusiness: suggested.business,
            fareFirst: suggested.first,
            status: 'active',
        };

        const updatedRoutes = [...routes, newRoute];
        const currentTimeline = [...get().timeline];
        const currentTick = useEngineStore.getState().tick;
        const simulatedTimestamp = GENESIS_TIME + (currentTick * TICK_DURATION);

        const newEvent: TimelineEvent = {
            id: `evt-route-open-${newRoute.id}`,
            tick: currentTick,
            timestamp: simulatedTimestamp,
            type: 'purchase',
            routeId: newRoute.id,
            originIata: originIata,
            destinationIata: destinationIata,
            cost: SLOT_FEE,
            description: `Opened new route: ${originIata} ↔ ${destinationIata}. Slot fee: ${fpFormat(SLOT_FEE, 0)}`
        };

        const finalTimeline = [newEvent, ...currentTimeline].slice(0, 200);
        const updatedAirline = {
            ...airline,
            corporateBalance: fpSub(airline.corporateBalance, SLOT_FEE),
            routeIds: [...airline.routeIds, newRoute.id],
            timeline: finalTimeline
        };

        const previousState = { airline, fleet, routes, timeline: get().timeline };

        set({
            airline: updatedAirline,
            routes: updatedRoutes,
            timeline: finalTimeline
        });

        try {
            await publishAirline({
                ...updatedAirline,
                fleet,
                routes: updatedRoutes,
                timeline: finalTimeline,
                lastTick: currentTick,
            });
        } catch (e) {
            set(previousState);
            console.error("Failed to sync route to Nostr:", e);
        }
    },

    assignAircraftToRoute: async (aircraftId: string, routeId: string | null) => {
        const { fleet, routes, airline } = get();
        if (!airline) return;

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

        const currentTimeline = [...get().timeline];
        const currentTick = useEngineStore.getState().tick;
        const simulatedTimestamp = GENESIS_TIME + (currentTick * TICK_DURATION);

        const aircraftName = aircraft?.name || 'Aircraft';
        const routeName = route ? `${route.originIata}-${route.destinationIata}` : 'None';

        const newEvent: TimelineEvent = {
            id: `evt-assign-${aircraftId}-${currentTick}`,
            tick: currentTick,
            timestamp: simulatedTimestamp,
            type: 'maintenance',
            aircraftId,
            aircraftName,
            routeId: routeId || undefined,
            description: routeId
                ? `Assigned ${aircraftName} to route ${routeName}.`
                : `Unassigned ${aircraftName} from all routes.`
        };

        const finalTimeline = [newEvent, ...currentTimeline].slice(0, 200);
        const updatedAirline = {
            ...airline,
            timeline: finalTimeline
        };

        const previousState = { airline, fleet, routes, timeline: get().timeline };

        set({
            airline: updatedAirline,
            fleet: updatedFleet,
            routes: updatedRoutes,
            timeline: finalTimeline
        });

        try {
            await publishAirline({
                ...updatedAirline,
                fleet: updatedFleet,
                routes: updatedRoutes,
                timeline: finalTimeline,
                lastTick: currentTick
            });
        } catch (e) {
            set(previousState);
            console.error("Failed to sync assignment to Nostr:", e);
        }
    },

    updateRouteFares: async (routeId: string, fares: { economy?: FixedPoint; business?: FixedPoint; first?: FixedPoint }) => {
        const { routes, airline, fleet } = get();
        if (!airline) return;

        const updatedRoutes = routes.map(rt => {
            if (rt.id === routeId) {
                return {
                    ...rt,
                    fareEconomy: fares.economy !== undefined ? fares.economy : rt.fareEconomy,
                    fareBusiness: fares.business !== undefined ? fares.business : rt.fareBusiness,
                    fareFirst: fares.first !== undefined ? fares.first : rt.fareFirst,
                };
            }
            return rt;
        });

        const currentTimeline = get().timeline;
        const updatedAirline = {
            ...airline,
            timeline: currentTimeline
        };

        const previousState = { airline, fleet, routes, timeline: get().timeline };

        set({ routes: updatedRoutes, airline: updatedAirline });

        try {
            await publishAirline({
                ...updatedAirline,
                fleet,
                routes: updatedRoutes,
                timeline: currentTimeline,
                lastTick: useEngineStore.getState().tick
            });
        } catch (e) {
            set(previousState);
            console.error("Failed to sync fares to Nostr:", e);
        }
    },
});
