import type { StateCreator } from 'zustand';
import type { AirlineState } from '../types';
import type { AirlineEntity, FlightOffer, Route, AircraftInstance, TimelineEvent } from '@airtr/core';
import { fpAdd, fpFormat, GENESIS_TIME, TICK_DURATION } from '@airtr/core';
import { loadGlobalAirlines, publishAirline, getNDK, NDKEvent, MARKETPLACE_KIND } from '@airtr/nostr';
import { getAircraftById } from '@airtr/data';
import { useEngineStore } from '../engine';
import { processFlightEngine } from '../FlightEngine';

export interface WorldSlice {
    competitors: Map<string, AirlineEntity>;
    globalRouteRegistry: Map<string, FlightOffer[]>;
    globalFleet: AircraftInstance[];
    globalRoutes: Route[];
    syncWorld: () => Promise<void>;
    processGlobalTick: (tick: number) => void;
}

export const createWorldSlice: StateCreator<
    AirlineState,
    [],
    [],
    WorldSlice
> = (set, get) => ({
    competitors: new Map(),
    globalRouteRegistry: new Map(),
    globalFleet: [],
    globalRoutes: [],

    processGlobalTick: (tick: number) => {
        const { competitors, globalFleet, globalRoutes } = get();
        if (competitors.size === 0) return;

        // Group fleet and routes by owner for efficient batch processing
        const fleetByOwner = new Map<string, AircraftInstance[]>();
        for (const ac of globalFleet) {
            const list = fleetByOwner.get(ac.ownerPubkey) || [];
            list.push(ac);
            fleetByOwner.set(ac.ownerPubkey, list);
        }

        const routesByOwner = new Map<string, Route[]>();
        for (const r of globalRoutes) {
            const list = routesByOwner.get(r.airlinePubkey) || [];
            list.push(r);
            routesByOwner.set(r.airlinePubkey, list);
        }

        const updatedGlobalFleet: AircraftInstance[] = [];
        const updatedCompetitors = new Map(competitors);
        let anyChanges = false;

        for (const [pubkey, airline] of competitors) {
            const compFleet = fleetByOwner.get(pubkey) || [];
            const compRoutes = routesByOwner.get(pubkey) || [];

            // Skip if no flights to process
            if (compFleet.length === 0) continue;

            // We advance each competitor by 1 tick using the same deterministic engine
            const result = processFlightEngine(
                tick,
                compFleet,
                compRoutes,
                airline.corporateBalance,
                tick - 1,
                new Map(), // Visual only: ignore global market for speed
                pubkey,
                airline.brandScore || 0.5
            );

            updatedGlobalFleet.push(...result.updatedFleet);

            if (result.hasChanges) {
                anyChanges = true;
                updatedCompetitors.set(pubkey, {
                    ...airline,
                    corporateBalance: result.corporateBalance,
                    lastTick: tick
                });
            }
        }

        if (anyChanges || updatedGlobalFleet.length !== globalFleet.length) {
            set({
                globalFleet: updatedGlobalFleet,
                competitors: updatedCompetitors
            });
        }
    },

    syncWorld: async () => {
        try {
            const results = await loadGlobalAirlines();
            const competitors = new Map<string, AirlineEntity>();
            const registry = new Map<string, FlightOffer[]>();
            const allGlobalFleet: AircraftInstance[] = [];
            const allGlobalRoutes: Route[] = [];
            const globalTick = useEngineStore.getState().tick;

            // Process results into maps and flat arrays
            for (const { airline, fleet, routes } of results) {
                // Skip our own airline if it's in the global results
                if (airline.ceoPubkey === get().pubkey) continue;

                // Visual Catch-up: Simulate what other planes would be doing right now
                // if their owners were online. This makes the world feel alive.
                const lastTick = airline.lastTick ?? (globalTick - 1);
                let currentFleet = [...fleet];
                let currentBalance = airline.corporateBalance;

                // Capped catch-up to avoid heavy UI blocking
                const MAX_CATCHUP = 10000; // ~8 hours of catch-up
                const targetTick = Math.min(globalTick, lastTick + MAX_CATCHUP);

                if (targetTick > lastTick) {
                    for (let t = lastTick + 1; t <= targetTick; t++) {
                        const res = processFlightEngine(
                            t,
                            currentFleet,
                            routes,
                            currentBalance,
                            t - 1,
                            new Map(), // Visual only: ignore global market for speed
                            airline.ceoPubkey,
                            airline.brandScore || 0.5
                        );
                        currentFleet = res.updatedFleet;
                        currentBalance = res.corporateBalance;
                    }
                }

                const updatedAirline = {
                    ...airline,
                    corporateBalance: currentBalance,
                    lastTick: targetTick
                };

                competitors.set(airline.ceoPubkey, updatedAirline);
                allGlobalFleet.push(...currentFleet);
                allGlobalRoutes.push(...routes);

                // For each route, create a FlightOffer
                for (const route of routes) {
                    if (route.status !== 'active') continue;

                    const key = `${route.originIata}-${route.destinationIata}`;
                    const offers = registry.get(key) || [];

                    const frequency = Math.max(0, route.assignedAircraftIds.length * 7);
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
                            if (!model) return 480;
                            return (route.distanceKm / (model.speedKmh || 800)) * 60;
                        });
                        avgTravelTime = times.length > 0 ? times.reduce((a: number, b: number) => a + b, 0) / times.length : 480;
                    }

                    const offer: FlightOffer = {
                        airlinePubkey: airline.ceoPubkey,
                        fareEconomy: route.fareEconomy,
                        fareBusiness: route.fareBusiness,
                        fareFirst: route.fareFirst,
                        frequencyPerWeek: frequency,
                        travelTimeMinutes: Math.round(avgTravelTime) || 480,
                        stops: 0,
                        serviceScore: 0.7,
                        brandScore: airline.brandScore || 0.5,
                    };

                    offers.push(offer);
                    registry.set(key, offers);
                }
            }

            set({
                competitors,
                globalRouteRegistry: registry,
                globalFleet: allGlobalFleet,
                globalRoutes: allGlobalRoutes
            });

            // --- Seller-side settlement ---
            // Detect aircraft we listed for sale that now appear in a competitor's fleet.
            // This means the buyer purchased it; we must settle: remove from our fleet,
            // credit the listing price, delete our marketplace event (NIP-09 compliant),
            // and record a timeline event.
            await settleMarketplaceSales(get, set, allGlobalFleet);

        } catch (error) {
            console.error('[WorldSlice] Failed to sync world:', error);
        }
    }
});

/**
 * Seller-side marketplace settlement.
 *
 * For each aircraft in our fleet that has a `listingPrice` set, check if the
 * same instanceId now exists in a competitor's fleet (globalFleet). If so,
 * the buyer has claimed it — settle the transaction on our side.
 */
async function settleMarketplaceSales(
    get: () => AirlineState,
    set: (state: Partial<AirlineState>) => void,
    globalFleet: AircraftInstance[]
): Promise<void> {
    const { airline, fleet, routes, timeline, pubkey } = get();
    if (!airline || !pubkey) return;

    // Build a set of all aircraft IDs owned by competitors
    const competitorAircraftIds = new Set(globalFleet.map(ac => ac.id));

    // Find our listed aircraft that now appear in a competitor's fleet
    const soldAircraft = fleet.filter(ac =>
        ac.listingPrice != null &&
        ac.listingPrice > 0 &&
        competitorAircraftIds.has(ac.id)
    );

    if (soldAircraft.length === 0) return;

    console.info(`[WorldSlice] Detected ${soldAircraft.length} sold aircraft requiring settlement.`);

    const currentTick = useEngineStore.getState().tick;
    let updatedFleet = [...fleet];
    let updatedBalance = airline.corporateBalance;
    const newTimelineEvents: TimelineEvent[] = [];

    for (const sold of soldAircraft) {
        const salePrice = sold.listingPrice!;
        updatedBalance = fpAdd(updatedBalance, salePrice);

        // Remove from fleet
        updatedFleet = updatedFleet.filter(ac => ac.id !== sold.id);

        // Remove from any assigned routes
        const simulatedTimestamp = GENESIS_TIME + (currentTick * TICK_DURATION);

        const saleEvent: TimelineEvent = {
            id: `evt-marketplace-sale-${sold.id}-${currentTick}`,
            tick: currentTick,
            timestamp: simulatedTimestamp,
            type: 'sale',
            aircraftId: sold.id,
            aircraftName: sold.name,
            revenue: salePrice,
            description: `Sold ${sold.name} on marketplace for ${fpFormat(salePrice, 0)}. Settlement completed.`
        };

        newTimelineEvents.push(saleEvent);
        console.info(`[WorldSlice] Settled sale of ${sold.name} (${sold.id}) for ${fpFormat(salePrice, 0)}`);
    }

    // Clean up routes that referenced sold aircraft
    const soldIds = new Set(soldAircraft.map(ac => ac.id));
    const updatedRoutes = routes.map(rt => {
        const cleaned = rt.assignedAircraftIds.filter(id => !soldIds.has(id));
        return cleaned.length !== rt.assignedAircraftIds.length
            ? { ...rt, assignedAircraftIds: cleaned }
            : rt;
    });

    const updatedAirline = {
        ...airline,
        corporateBalance: updatedBalance,
        fleetIds: updatedFleet.map(ac => ac.id)
    };

    const finalTimeline = [...newTimelineEvents, ...timeline].slice(0, 200);

    // Optimistic update
    set({
        airline: updatedAirline,
        fleet: updatedFleet,
        routes: updatedRoutes,
        timeline: finalTimeline
    });

    // Publish updated airline state + delete marketplace listings (seller-signed, NIP-09 compliant)
    try {
        await publishAirline({
            ...updatedAirline,
            fleet: updatedFleet,
            routes: updatedRoutes,
            timeline: finalTimeline,
            lastTick: currentTick,
        });

        // Delete our own marketplace listings (we are the author, so NIP-09 allows this)
        const ndk = getNDK();
        for (const sold of soldAircraft) {
            try {
                const deletionEvent = new NDKEvent(ndk);
                deletionEvent.kind = 5;
                deletionEvent.tags = [
                    ['a', `${MARKETPLACE_KIND}:${pubkey}:airtr:marketplace:${sold.id}`]
                ];
                await deletionEvent.publish();
                console.info(`[WorldSlice] Published NIP-09 deletion for marketplace listing: ${sold.id}`);
            } catch (e) {
                // Non-critical: listing will be filtered by ownership verification on other clients
                console.warn(`[WorldSlice] Failed to publish deletion for listing ${sold.id}:`, e);
            }
        }
    } catch (e) {
        // Rollback on publish failure
        console.error('[WorldSlice] Failed to publish marketplace settlement:', e);
        set({ airline, fleet, routes, timeline });
    }
}
