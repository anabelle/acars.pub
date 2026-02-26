import type {
  AircraftInstance,
  AirlineEntity,
  FlightOffer,
  Route,
  TimelineEvent,
} from "@airtr/core";
import { fpAdd, fpFormat, GENESIS_TIME, TICK_DURATION } from "@airtr/core";
import { getAircraftById } from "@airtr/data";
import { getNDK, loadActionLog, loadCheckpoints, MARKETPLACE_KIND, NDKEvent } from "@airtr/nostr";
import type { StateCreator } from "zustand";
import { replayActionLog } from "../actionReducer";
import { useEngineStore } from "../engine";
import { processFlightEngine } from "../FlightEngine";
import type { AirlineState } from "../types";

export interface WorldSlice {
  competitors: Map<string, AirlineEntity>;
  globalRouteRegistry: Map<string, FlightOffer[]>;
  globalFleet: AircraftInstance[];
  globalFleetByOwner: Map<string, AircraftInstance[]>;
  globalRoutes: Route[];
  globalRoutesByOwner: Map<string, Route[]>;
  syncWorld: () => Promise<void>;
  processGlobalTick: (tick: number) => Promise<void>;
}

let isProcessingGlobal = false;
const GLOBAL_CATCHUP_CHUNK = 200;
const MAX_COMPETITOR_CATCHUP = 1000;
const MAX_TOTAL_COMPETITOR_TICKS = 5000;

const buildFleetIndex = (fleet: AircraftInstance[]) => {
  const byOwner = new Map<string, AircraftInstance[]>();
  for (const aircraft of fleet) {
    const bucket = byOwner.get(aircraft.ownerPubkey);
    if (bucket) {
      bucket.push(aircraft);
    } else {
      byOwner.set(aircraft.ownerPubkey, [aircraft]);
    }
  }
  return byOwner;
};

const buildRoutesIndex = (routes: Route[]) => {
  const byOwner = new Map<string, Route[]>();
  for (const route of routes) {
    const bucket = byOwner.get(route.airlinePubkey);
    if (bucket) {
      bucket.push(route);
    } else {
      byOwner.set(route.airlinePubkey, [route]);
    }
  }
  return byOwner;
};

export const createWorldSlice: StateCreator<AirlineState, [], [], WorldSlice> = (set, get) => ({
  competitors: new Map(),
  globalRouteRegistry: new Map(),
  globalFleet: [],
  globalFleetByOwner: new Map(),
  globalRoutes: [],
  globalRoutesByOwner: new Map(),

  processGlobalTick: async (tick: number) => {
    if (isProcessingGlobal) return;

    const {
      competitors,
      globalFleetByOwner,
      globalRoutesByOwner,
      globalRouteRegistry,
      routes,
      fleet,
      pubkey: playerPubkey,
      airline: playerAirline,
    } = get();
    if (competitors.size === 0) return;

    isProcessingGlobal = true;
    try {
      const updatedGlobalFleet: AircraftInstance[] = [];
      const updatedCompetitors = new Map(competitors);
      let anyChanges = false;
      useEngineStore.setState({ catchupProgress: { current: 0, target: 0, phase: "competitor" } });

      const playerRouteRegistry = new Map<string, FlightOffer[]>();
      const playerBrandScore = playerAirline?.brandScore || 0.5;
      for (const route of routes) {
        if (route.status !== "active") continue;

        const frequency = Math.max(0, route.assignedAircraftIds.length * 7);
        if (frequency === 0) continue;

        let avgTravelTime = 0;
        if (route.assignedAircraftIds.length > 0) {
          const modelIds = route.assignedAircraftIds
            .map((id: string) => {
              const ac = fleet.find((a: AircraftInstance) => a.id === id);
              return ac?.modelId;
            })
            .filter(Boolean);

          const times = modelIds.map((mid: string | undefined) => {
            const model = getAircraftById(mid!);
            if (!model) return 480;
            return (route.distanceKm / (model.speedKmh || 800)) * 60;
          });
          avgTravelTime =
            times.length > 0
              ? times.reduce((a: number, b: number) => a + b, 0) / times.length
              : 480;
        }

        const key = `${route.originIata}-${route.destinationIata}`;
        const offers = playerRouteRegistry.get(key) || [];
        const offer: FlightOffer = {
          airlinePubkey: playerPubkey || "",
          fareEconomy: route.fareEconomy,
          fareBusiness: route.fareBusiness,
          fareFirst: route.fareFirst,
          frequencyPerWeek: frequency,
          travelTimeMinutes: Math.round(avgTravelTime) || 480,
          stops: 0,
          serviceScore: 0.7,
          brandScore: playerBrandScore,
        };
        offers.push(offer);
        playerRouteRegistry.set(key, offers);
      }

      const globalRegistryEntries = [...globalRouteRegistry.entries()];

      let totalTicksProcessed = 0;
      const competitorList = [...competitors.entries()];
      competitorList.sort(([, aAirline], [, bAirline]) => {
        const aLast = aAirline.lastTick ?? tick - 1;
        const bLast = bAirline.lastTick ?? tick - 1;
        return tick - bLast - (tick - aLast);
      });

      for (const [competitorPubkey, airline] of competitorList) {
        if (totalTicksProcessed >= MAX_TOTAL_COMPETITOR_TICKS) break;

        const airlineLastTick = airline.lastTick ?? tick - 1;
        const compFleet = globalFleetByOwner.get(competitorPubkey) || [];
        const compRoutes = globalRoutesByOwner.get(competitorPubkey) || [];

        if (compFleet.length === 0) continue;

        if (airlineLastTick >= tick) {
          updatedGlobalFleet.push(...compFleet);
          continue;
        }

        let currentFleet = [...compFleet];
        let currentBalance = airline.corporateBalance;

        const remainingBudget = MAX_TOTAL_COMPETITOR_TICKS - totalTicksProcessed;
        const allowedCatchup = Math.min(MAX_COMPETITOR_CATCHUP, remainingBudget);
        const targetTick = Math.min(tick, airlineLastTick + allowedCatchup);
        const startTick = airlineLastTick + 1;

        const competitorRegistry = new Map<string, FlightOffer[]>();
        for (const [routeKey, offers] of globalRegistryEntries) {
          const filtered = offers.filter((o) => o.airlinePubkey !== competitorPubkey);
          if (filtered.length > 0) competitorRegistry.set(routeKey, filtered);
        }
        for (const [routeKey, offers] of playerRouteRegistry) {
          const existing = competitorRegistry.get(routeKey) || [];
          competitorRegistry.set(routeKey, [...existing, ...offers]);
        }

        for (let t = startTick; t <= targetTick; t++) {
          const result = processFlightEngine(
            t,
            currentFleet,
            compRoutes,
            currentBalance,
            t - 1,
            competitorRegistry,
            competitorPubkey,
            airline.brandScore || 0.5,
          );
          currentFleet = result.updatedFleet;
          currentBalance = result.corporateBalance;

          if (
            GLOBAL_CATCHUP_CHUNK > 0 &&
            (t - startTick + 1) % GLOBAL_CATCHUP_CHUNK === 0 &&
            t < targetTick
          ) {
            useEngineStore.setState({
              catchupProgress: {
                current: totalTicksProcessed + (t - startTick + 1),
                target: MAX_TOTAL_COMPETITOR_TICKS,
                phase: "competitor",
              },
            });
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }

        const ticksProcessed = Math.max(0, targetTick - airlineLastTick);
        totalTicksProcessed += ticksProcessed;

        updatedGlobalFleet.push(...currentFleet);
        updatedCompetitors.set(competitorPubkey, {
          ...airline,
          corporateBalance: currentBalance,
          lastTick: targetTick,
        });
        anyChanges = true;
      }

      if (!anyChanges) {
        useEngineStore.setState({ catchupProgress: null });
        return;
      }

      const updatedPubkeys = new Set(updatedCompetitors.keys());
      const finalFleet = [
        ...updatedGlobalFleet,
        ...Array.from(globalFleetByOwner.entries())
          .filter(([pubkey]) => !updatedPubkeys.has(pubkey))
          .flatMap(([, aircraft]) => aircraft),
      ];

      set({
        globalFleet: finalFleet,
        globalFleetByOwner: buildFleetIndex(finalFleet),
        competitors: updatedCompetitors,
      });
      useEngineStore.setState({ catchupProgress: null });
    } finally {
      isProcessingGlobal = false;
    }
  },

  syncWorld: async () => {
    try {
      const existingState = get();
      const actions = await loadActionLog({ limit: 500, maxPages: 20 });
      const authorPubkeys = Array.from(new Set(actions.map((entry) => entry.event.author.pubkey)));
      const checkpoints = await loadCheckpoints(authorPubkeys);
      const competitors = new Map<string, AirlineEntity>();
      const registry = new Map<string, FlightOffer[]>();
      const allGlobalFleet: AircraftInstance[] = [];
      const allGlobalRoutes: Route[] = [];

      const actionsByPubkey = new Map<string, typeof actions>();
      for (const entry of actions) {
        const author = entry.event.author.pubkey;
        const bucket = actionsByPubkey.get(author) || [];
        bucket.push(entry);
        actionsByPubkey.set(author, bucket);
      }

      for (const [authorPubkey, entries] of actionsByPubkey.entries()) {
        if (authorPubkey === existingState.pubkey) continue;

        const checkpoint = checkpoints.get(authorPubkey) ?? null;
        let scopedEntries = entries;
        if (checkpoint) {
          scopedEntries = entries.filter(
            (entry) => (entry.event.created_at ?? 0) >= checkpoint.createdAt,
          );
          if (scopedEntries.length === 0) scopedEntries = entries;
        }
        const replayed = await replayActionLog({
          pubkey: authorPubkey,
          actions: scopedEntries.map((entry) => ({
            action: entry.action,
            eventId: entry.event.id,
            authorPubkey: entry.event.author.pubkey,
            createdAt: entry.event.created_at ?? null,
          })),
          checkpoint,
        });

        if (!replayed.airline) continue;

        const airline = replayed.airline;
        const fleet = replayed.fleet;
        const routes = replayed.routes;

        const existingCompetitor = existingState.competitors.get(authorPubkey) ?? null;
        const existingLastTick = existingCompetitor?.lastTick ?? -1;
        const parsedLastTick = airline.lastTick ?? 0;

        const resolvedAirline =
          existingCompetitor && existingLastTick > parsedLastTick ? existingCompetitor : airline;
        const resolvedFleet =
          existingCompetitor && existingLastTick > parsedLastTick
            ? existingState.globalFleetByOwner.get(authorPubkey) || []
            : fleet;
        const resolvedRoutes =
          existingCompetitor && existingLastTick > parsedLastTick
            ? existingState.globalRoutesByOwner.get(authorPubkey) || []
            : routes;

        competitors.set(authorPubkey, resolvedAirline);
        allGlobalFleet.push(...resolvedFleet);
        allGlobalRoutes.push(...resolvedRoutes);

        for (const route of resolvedRoutes) {
          if (route.status !== "active") continue;

          const key = `${route.originIata}-${route.destinationIata}`;
          const offers = registry.get(key) || [];

          const frequency = Math.max(0, route.assignedAircraftIds.length * 7);
          if (frequency === 0) continue;

          let avgTravelTime = 0;
          if (route.assignedAircraftIds.length > 0) {
            const modelIds = route.assignedAircraftIds
              .map((id: string) => {
                const ac = resolvedFleet.find((a: AircraftInstance) => a.id === id);
                return ac?.modelId;
              })
              .filter(Boolean);

            const times = modelIds.map((mid: string | undefined) => {
              const model = getAircraftById(mid!);
              if (!model) return 480;
              return (route.distanceKm / (model.speedKmh || 800)) * 60;
            });
            avgTravelTime =
              times.length > 0
                ? times.reduce((a: number, b: number) => a + b, 0) / times.length
                : 480;
          }

          const offer: FlightOffer = {
            airlinePubkey: resolvedAirline.ceoPubkey,
            fareEconomy: route.fareEconomy,
            fareBusiness: route.fareBusiness,
            fareFirst: route.fareFirst,
            frequencyPerWeek: frequency,
            travelTimeMinutes: Math.round(avgTravelTime) || 480,
            stops: 0,
            serviceScore: 0.7,
            brandScore: resolvedAirline.brandScore || 0.5,
          };

          offers.push(offer);
          registry.set(key, offers);
        }
      }

      const initialTick = useEngineStore.getState().tick;
      const MAX_INITIAL_CATCHUP = 10000;

      if (initialTick > 0 && competitors.size > 0) {
        const playerRouteRegistry = new Map<string, FlightOffer[]>();
        const playerBrandScore = existingState.airline?.brandScore || 0.5;
        for (const route of existingState.routes) {
          if (route.status !== "active") continue;

          const frequency = Math.max(0, route.assignedAircraftIds.length * 7);
          if (frequency === 0) continue;

          let avgTravelTime = 0;
          if (route.assignedAircraftIds.length > 0) {
            const modelIds = route.assignedAircraftIds
              .map((id: string) => {
                const ac = existingState.fleet.find((a: AircraftInstance) => a.id === id);
                return ac?.modelId;
              })
              .filter(Boolean);

            const times = modelIds.map((mid: string | undefined) => {
              const model = getAircraftById(mid!);
              if (!model) return 480;
              return (route.distanceKm / (model.speedKmh || 800)) * 60;
            });
            avgTravelTime =
              times.length > 0
                ? times.reduce((a: number, b: number) => a + b, 0) / times.length
                : 480;
          }

          const key = `${route.originIata}-${route.destinationIata}`;
          const offers = playerRouteRegistry.get(key) || [];
          const offer: FlightOffer = {
            airlinePubkey: existingState.pubkey || "",
            fareEconomy: route.fareEconomy,
            fareBusiness: route.fareBusiness,
            fareFirst: route.fareFirst,
            frequencyPerWeek: frequency,
            travelTimeMinutes: Math.round(avgTravelTime) || 480,
            stops: 0,
            serviceScore: 0.7,
            brandScore: playerBrandScore,
          };
          offers.push(offer);
          playerRouteRegistry.set(key, offers);
        }

        const globalRegistryEntries = [...registry.entries()];
        const updatedGlobalFleet: AircraftInstance[] = [];
        const updatedCompetitors = new Map(competitors);

        let totalTicksProcessed = 0;
        useEngineStore.setState({
          catchupProgress: { current: 0, target: MAX_TOTAL_COMPETITOR_TICKS, phase: "competitor" },
        });
        const competitorList = [...competitors.entries()];
        competitorList.sort(([, aAirline], [, bAirline]) => {
          const aLast = aAirline.lastTick ?? initialTick - 1;
          const bLast = bAirline.lastTick ?? initialTick - 1;
          return initialTick - bLast - (initialTick - aLast);
        });

        const allFleetByOwner = buildFleetIndex(allGlobalFleet);
        const allRoutesByOwner = buildRoutesIndex(allGlobalRoutes);

        for (const [competitorPubkey, airline] of competitorList) {
          if (totalTicksProcessed >= MAX_TOTAL_COMPETITOR_TICKS) break;
          const airlineLastTick = airline.lastTick ?? initialTick - 1;
          const compFleet = allFleetByOwner.get(competitorPubkey) || [];
          const compRoutes = allRoutesByOwner.get(competitorPubkey) || [];

          if (compFleet.length === 0) continue;

          if (airlineLastTick >= initialTick) {
            updatedGlobalFleet.push(...compFleet);
            continue;
          }

          const remainingBudget = MAX_TOTAL_COMPETITOR_TICKS - totalTicksProcessed;
          const allowedCatchup = Math.min(MAX_INITIAL_CATCHUP, remainingBudget);
          const targetTick = Math.min(initialTick, airlineLastTick + allowedCatchup);
          const competitorRegistry = new Map<string, FlightOffer[]>();
          for (const [routeKey, offers] of globalRegistryEntries) {
            const filtered = offers.filter((o) => o.airlinePubkey !== competitorPubkey);
            if (filtered.length > 0) competitorRegistry.set(routeKey, filtered);
          }
          for (const [routeKey, offers] of playerRouteRegistry) {
            const existing = competitorRegistry.get(routeKey) || [];
            competitorRegistry.set(routeKey, [...existing, ...offers]);
          }

          let currentFleet = [...compFleet];
          let currentBalance = airline.corporateBalance;
          const startTick = airlineLastTick + 1;

          for (let t = startTick; t <= targetTick; t++) {
            const result = processFlightEngine(
              t,
              currentFleet,
              compRoutes,
              currentBalance,
              t - 1,
              competitorRegistry,
              competitorPubkey,
              airline.brandScore || 0.5,
            );
            currentFleet = result.updatedFleet;
            currentBalance = result.corporateBalance;

            if (
              GLOBAL_CATCHUP_CHUNK > 0 &&
              (t - startTick + 1) % GLOBAL_CATCHUP_CHUNK === 0 &&
              t < targetTick
            ) {
              useEngineStore.setState({
                catchupProgress: {
                  current: totalTicksProcessed + (t - startTick + 1),
                  target: MAX_TOTAL_COMPETITOR_TICKS,
                  phase: "competitor",
                },
              });
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }

          const ticksProcessed = Math.max(0, targetTick - airlineLastTick);
          totalTicksProcessed += ticksProcessed;

          updatedGlobalFleet.push(...currentFleet);
          updatedCompetitors.set(competitorPubkey, {
            ...airline,
            corporateBalance: currentBalance,
            lastTick: targetTick,
          });
        }

        const updatedPubkeys = new Set(updatedCompetitors.keys());
        const finalFleet = [
          ...allGlobalFleet.filter((ac) => !updatedPubkeys.has(ac.ownerPubkey)),
          ...updatedGlobalFleet,
        ];

        set({
          competitors: updatedCompetitors,
          globalFleet: finalFleet,
          globalFleetByOwner: buildFleetIndex(finalFleet),
          globalRoutes: allGlobalRoutes,
          globalRoutesByOwner: buildRoutesIndex(allGlobalRoutes),
          globalRouteRegistry: registry,
        });
        useEngineStore.setState({ catchupProgress: null });

        await settleMarketplaceSales(get, set, finalFleet);
        return;
      }

      set({
        competitors,
        globalRouteRegistry: registry,
        globalFleet: allGlobalFleet,
        globalFleetByOwner: buildFleetIndex(allGlobalFleet),
        globalRoutes: allGlobalRoutes,
        globalRoutesByOwner: buildRoutesIndex(allGlobalRoutes),
      });
      useEngineStore.setState({ catchupProgress: null });

      // --- Seller-side settlement ---
      // Detect aircraft we listed for sale that now appear in a competitor's fleet.
      // This means the buyer purchased it; we must settle: remove from our fleet,
      // credit the listing price, delete our marketplace event (NIP-09 compliant),
      // and record a timeline event.
      await settleMarketplaceSales(get, set, allGlobalFleet);
    } catch (error) {
      console.error("[WorldSlice] Failed to sync world:", error);
      useEngineStore.setState({ catchupProgress: null });
    }
  },
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
  globalFleet: AircraftInstance[],
): Promise<void> {
  const { airline, fleet, routes, timeline, pubkey } = get();
  if (!airline || !pubkey) return;

  // Build a set of all aircraft IDs owned by competitors
  const competitorAircraftIds = new Set(globalFleet.map((ac) => ac.id));

  // Find our listed aircraft that now appear in a competitor's fleet
  const soldAircraft = fleet.filter(
    (ac) => ac.listingPrice != null && ac.listingPrice > 0 && competitorAircraftIds.has(ac.id),
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
    updatedFleet = updatedFleet.filter((ac) => ac.id !== sold.id);

    // Remove from any assigned routes
    const simulatedTimestamp = GENESIS_TIME + currentTick * TICK_DURATION;

    const saleEvent: TimelineEvent = {
      id: `evt-marketplace-sale-${sold.id}-${currentTick}`,
      tick: currentTick,
      timestamp: simulatedTimestamp,
      type: "sale",
      aircraftId: sold.id,
      aircraftName: sold.name,
      revenue: salePrice,
      description: `Sold ${sold.name} on marketplace for ${fpFormat(salePrice, 0)}. Settlement completed.`,
    };

    newTimelineEvents.push(saleEvent);
    console.info(
      `[WorldSlice] Settled sale of ${sold.name} (${sold.id}) for ${fpFormat(salePrice, 0)}`,
    );
  }

  // Clean up routes that referenced sold aircraft
  const soldIds = new Set(soldAircraft.map((ac) => ac.id));
  const updatedRoutes = routes.map((rt) => {
    const cleaned = rt.assignedAircraftIds.filter((id) => !soldIds.has(id));
    return cleaned.length !== rt.assignedAircraftIds.length
      ? { ...rt, assignedAircraftIds: cleaned }
      : rt;
  });

  const updatedAirline = {
    ...airline,
    corporateBalance: updatedBalance,
    fleetIds: updatedFleet.map((ac) => ac.id),
  };

  const finalTimeline = [...newTimelineEvents, ...timeline].slice(0, 1000);

  // Optimistic update
  set({
    airline: updatedAirline,
    fleet: updatedFleet,
    routes: updatedRoutes,
    timeline: finalTimeline,
  });

  // Publish updated airline state + delete marketplace listings (seller-signed, NIP-09 compliant)
  try {
    // Delete our own marketplace listings (we are the author, so NIP-09 allows this)
    const ndk = getNDK();
    for (const sold of soldAircraft) {
      try {
        const deletionEvent = new NDKEvent(ndk);
        deletionEvent.kind = 5;
        deletionEvent.tags = [["a", `${MARKETPLACE_KIND}:${pubkey}:airtr:marketplace:${sold.id}`]];
        await deletionEvent.publish();
        console.info(`[WorldSlice] Published NIP-09 deletion for marketplace listing: ${sold.id}`);
      } catch (e) {
        // Non-critical: listing will be filtered by ownership verification on other clients
        console.warn(`[WorldSlice] Failed to publish deletion for listing ${sold.id}:`, e);
      }
    }
  } catch (e) {
    // Rollback on publish failure
    console.error("[WorldSlice] Failed to publish marketplace settlement:", e);
    set({ airline, fleet, routes, timeline });
  }
}
