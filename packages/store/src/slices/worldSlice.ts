import type {
  AircraftInstance,
  AirlineEntity,
  Checkpoint,
  FixedPoint,
  FlightOffer,
  GameActionEnvelope,
  Route,
  TimelineEvent,
} from "@acars/core";
import {
  canonicalRouteKey,
  computeRouteFrequency,
  createLogger,
  fp,
  fpAdd,
  fpFormat,
  fpRaw,
  fpScale,
  fpSub,
  GENESIS_TIME,
  TICK_DURATION,
  TICKS_PER_MONTH,
} from "@acars/core";
import { getAircraftById, getHubPricingForIata } from "@acars/data";
import type { ActionLogEntry } from "@acars/nostr";
import type { StateCreator } from "zustand";
import { isAbandonedAirline } from "../abandonedAirlines";
import { replayActionLog } from "../actionReducer";
import { bootMark } from "../bootTrace";
import { useEngineStore } from "../engine";
import { reconcileFleetToTick } from "../FlightEngine";
import { computeRejectedBuyEventIds } from "../marketplaceReplay";
import { rivalRoutesNewOnYourPairs } from "../rivalRoutes";
import { scopeActionsToCheckpoint } from "../scopeActions";
import { selectProvenSales, UNPROVEN_CLAIM_RECHECK_MS } from "../marketplaceSettlement";
import { verifySnapshotPayload } from "../snapshotValidation";
import type { AirlineState } from "../types";

export interface WorldSlice {
  competitors: Map<string, AirlineEntity>;
  globalRouteRegistry: Map<string, FlightOffer[]>;
  /** Unified fleet index: ALL players (including self) keyed by pubkey. */
  fleetByOwner: Map<string, AircraftInstance[]>;
  /** Unified routes index: ALL players (including self) keyed by pubkey. */
  routesByOwner: Map<string, Route[]>;
  viewAs: (pubkey: string | null) => void;
  syncWorld: (options?: { force?: boolean }) => Promise<void>;
  syncCompetitor: (competitorPubkey: string, liveEvents?: ActionLogEntry[]) => Promise<void>;
  /**
   * Re-project all competitor fleets to the given tick using the pure
   * `reconcileFleetToTick` function.  Called every tick from the pipeline
   * to keep competitor aircraft positions current between `syncWorld` calls.
   */
  projectCompetitorFleet: (tick: number) => void;
}

let isSyncingWorld = false;
let pendingSyncWorldOptions: { force?: boolean } | null = null;
const MONTH_TICKS = TICKS_PER_MONTH;
const worldLogger = createLogger("WorldSync");

/**
 * Full snapshot resyncs per competitor are rate-limited to this interval;
 * in between, live events keep the competitor state current via the
 * incremental replay in `syncCompetitor`.
 */
const COMPETITOR_FULL_SYNC_INTERVAL_MS = 60_000;
const competitorLastFullSync = new Map<string, number>();

/**
 * Signature of the last snapshot payload REJECTED per competitor pubkey.
 * Validation is deterministic — an identical payload yields the identical
 * verdict — so we skip re-decompressing/re-validating (and re-logging) the
 * same invalid snapshot on every sync cycle. Keyed by
 * `${tick}:${stateHash}:${compressedData.length}`.
 */
const rejectedSnapshotSig = new Map<string, string>();

/** `${claimant}:${aircraftId}` → last time a sale claim was found unproven. */
const unprovenClaimCheckedAt = new Map<string, number>();

/**
 * Per-owner projection memo for projectCompetitorFleet: records the tick an
 * owner's fleet was last projected to AND the fleet array reference that was
 * produced. Competitor `airline.lastTick` only advances on sync (~60s), so
 * without this the slice re-projected every competitor fleet (O(worldFleet)
 * clones + landing financials) and installed a fresh `fleetByOwner` Map on
 * EVERY tick. The fleetRef check self-heals: when syncWorld/syncCompetitor
 * replaces an owner's fleet, the ref mismatch forces a fresh projection.
 */
const ownerProjection = new Map<string, { tick: number; fleetRef: AircraftInstance[] }>();

function snapshotPayloadSig(payload: {
  tick: number;
  stateHash: string;
  compressedData: string;
}): string {
  return `${payload.tick}:${payload.stateHash}:${payload.compressedData.length}`;
}

export function _resetWorldFlags() {
  isSyncingWorld = false;
  pendingSyncWorldOptions = null;
  competitorLastFullSync.clear();
  rejectedSnapshotSig.clear();
  ownerProjection.clear();
  unprovenClaimCheckedAt.clear();
}

const applyMonthlyCosts = (
  balance: FixedPoint,
  hubs: string[] | undefined,
  fleet: AircraftInstance[],
  fromTick: number,
  toTick: number,
): FixedPoint => {
  const cyclesPrevious = Math.floor(fromTick / MONTH_TICKS);
  const cyclesCurrent = Math.floor(toTick / MONTH_TICKS);
  if (cyclesCurrent <= cyclesPrevious) return balance;

  const numCycles = cyclesCurrent - cyclesPrevious;
  let opexTotal = 0;
  if (hubs && hubs.length > 0) {
    for (const hubIata of hubs) {
      opexTotal += getHubPricingForIata(hubIata).monthlyOpex;
    }
  }

  let leaseCost = fp(0);
  for (const ac of fleet) {
    if (ac.purchaseType !== "lease") continue;
    const model = getAircraftById(ac.modelId);
    if (model) {
      leaseCost = fpAdd(leaseCost, model.monthlyLease);
    }
  }

  const totalLeaseCost = fpScale(leaseCost, numCycles);
  const totalOpexCost = fpScale(fp(opexTotal), numCycles);
  const totalCost = fpAdd(totalLeaseCost, totalOpexCost);
  return fpSub(balance, totalCost);
};

/**
 * Add a player's active routes to the global route registry as flight
 * offers. Shared by the full `syncWorld` pass and the incremental
 * `syncCompetitor` replay so both paths compute offers identically.
 *
 * `ownerPubkey` is the authenticated owner (the snapshot's signing author /
 * the replayed author) and is stamped on every offer. Never derive the
 * offer principal from `airline.ceoPubkey`: rank-based fare policy keys on
 * it, and the body is publisher-controlled.
 */
export const buildRouteOffers = (
  registry: Map<string, FlightOffer[]>,
  ownerPubkey: string,
  airline: AirlineEntity,
  fleet: AircraftInstance[],
  routes: Route[],
): void => {
  // O(1) aircraft lookup for assignedAircraftIds resolution (was
  // fleet.find inside a map — O(F) per route).
  const fleetById = new Map(fleet.map((ac) => [ac.id, ac]));

  for (const route of routes) {
    if (route.status !== "active") continue;

    const key = canonicalRouteKey(route.originIata, route.destinationIata);
    const offers = registry.get(key) || [];

    let avgSpeed = 800;
    let avgTravelTime = 0;
    if (route.assignedAircraftIds.length > 0) {
      const models = route.assignedAircraftIds
        .map((id: string) => {
          const ac = fleetById.get(id);
          return ac ? getAircraftById(ac.modelId) : null;
        })
        .filter(Boolean);
      if (models.length > 0) {
        avgSpeed = models.reduce((sum, m) => sum + (m!.speedKmh || 800), 0) / models.length;
        avgTravelTime = (route.distanceKm / avgSpeed) * 60;
      }
    }

    const frequency = computeRouteFrequency(
      route.distanceKm,
      route.assignedAircraftIds.length,
      avgSpeed,
    );
    if (frequency === 0) continue;

    const offer: FlightOffer = {
      airlinePubkey: ownerPubkey,
      fareEconomy: route.fareEconomy,
      fareBusiness: route.fareBusiness,
      fareFirst: route.fareFirst,
      frequencyPerWeek: frequency,
      travelTimeMinutes: Math.round(avgTravelTime) || 480,
      stops: 0,
      serviceScore: 0.7,
      brandScore: airline.brandScore || 0.5,
      distanceKm: route.distanceKm,
    };
    // Announced fares (S69) ride along; the engine applies them from their tick.
    // (Rival frequency here comes from their planes, so only fares are announced.)
    const pending = route.pending;
    if (
      pending &&
      (pending.fareEconomy !== undefined ||
        pending.fareBusiness !== undefined ||
        pending.fareFirst !== undefined)
    ) {
      offer.next = {
        effectiveTick: pending.effectiveTick,
        ...(pending.fareEconomy !== undefined ? { fareEconomy: pending.fareEconomy } : {}),
        ...(pending.fareBusiness !== undefined ? { fareBusiness: pending.fareBusiness } : {}),
        ...(pending.fareFirst !== undefined ? { fareFirst: pending.fareFirst } : {}),
      };
    }

    offers.push(offer);
    registry.set(key, offers);
  }
};

export const createWorldSlice: StateCreator<AirlineState, [], [], WorldSlice> = (set, get) => ({
  competitors: new Map(),
  globalRouteRegistry: new Map(),
  fleetByOwner: new Map(),
  routesByOwner: new Map(),
  viewAs: (pubkey) => set({ viewedPubkey: pubkey }),

  /**
   * Lightweight tick-driven re-projection of competitor fleets.
   *
   * Instead of simulating competitor aircraft tick-by-tick (the old
   * `processGlobalTick`), this synchronously re-runs `reconcileFleetToTick`
   * on the stored fleet/routes snapshot.  Because the flight engine is fully
   * deterministic, this produces the correct aircraft positions for any tick
   * without requiring incremental simulation.
   *
   * IMPORTANT: This function updates `fleetByOwner` with projected positions
   * for competitors.  Player fleet is NOT re-projected here — it is kept in
   * sync by identitySlice/fleetSlice/engineSlice.
   *
   * reconcileFleetToTick updates lastTickProcessed on individual aircraft,
   * preventing double-counted landings on subsequent projection calls.
   */
  projectCompetitorFleet: (tick: number) => {
    const { competitors, fleetByOwner, routesByOwner } = get();
    if (competitors.size === 0) return;

    let anyChanges = false;
    const updatedFleetByOwner = new Map(fleetByOwner);

    for (const [pubkey, airline] of competitors) {
      const compFleet = fleetByOwner.get(pubkey) || [];
      const compRoutes = routesByOwner.get(pubkey) || [];

      // Match player semantics: bankrupt/liquidated airlines do not advance.
      if (airline.status === "chapter11" || airline.status === "liquidated") {
        continue;
      }

      if (compFleet.length === 0) {
        continue;
      }

      // Already at or ahead of this tick — carry forward as-is
      if (airline.lastTick != null && airline.lastTick >= tick) {
        continue;
      }

      // Already projected to this (or a later) tick from this exact fleet
      // state — identical deterministic outcome, skip the O(fleet) work.
      const prev = ownerProjection.get(pubkey);
      if (prev && prev.tick >= tick && fleetByOwner.get(pubkey) === prev.fleetRef) {
        continue;
      }

      // Project fleet positions and update the per-owner index.
      const { fleet: projectedFleet } = reconcileFleetToTick(compFleet, compRoutes, tick);
      updatedFleetByOwner.set(pubkey, projectedFleet);
      ownerProjection.set(pubkey, { tick, fleetRef: projectedFleet });
      anyChanges = true;
    }

    if (!anyChanges) return;

    set({ fleetByOwner: updatedFleetByOwner });
  },

  syncWorld: async (options?: { force?: boolean }) => {
    if (isSyncingWorld) {
      if (options?.force || pendingSyncWorldOptions?.force) {
        pendingSyncWorldOptions = { force: true };
      } else {
        pendingSyncWorldOptions = pendingSyncWorldOptions ?? {};
      }
      return;
    }
    isSyncingWorld = true;
    try {
      try {
        const existingState = get();
        // Load completely from Snapshot Rollups! Wait...
        const { loadAllSnapshots } = await import("@acars/nostr");

        bootMark("world: fetching rivals");
        const allSnapshots = await loadAllSnapshots();
        bootMark("world: rivals fetched", `${allSnapshots.size} snapshots`);

        const currentTick = useEngineStore.getState().tick;
        // Read after the fetch: on a reload the identity often loads while
        // the snapshots are in flight, and the player's own must not pass
        // for a rival's.
        const myPubkey = get().pubkey ?? existingState.pubkey;

        const competitors = new Map<string, AirlineEntity>(existingState.competitors);
        const registry = new Map<string, FlightOffer[]>();
        const updatedFleetByOwner = new Map<string, AircraftInstance[]>(existingState.fleetByOwner);
        const updatedRoutesByOwner = new Map<string, Route[]>(existingState.routesByOwner);
        const newTimelineEvents: TimelineEvent[] = [];
        const myHubs = new Set(existingState.airline?.hubs || []);

        // Seed player data into the unified maps
        if (myPubkey) {
          // A sync that ran before the identity loaded may have taken the
          // player's own snapshot for a rival's: never count it as one.
          competitors.delete(myPubkey);
          updatedFleetByOwner.set(myPubkey, existingState.fleet || []);
          updatedRoutesByOwner.set(myPubkey, existingState.routes || []);
        }

        for (const [pubkey, payload] of allSnapshots.entries()) {
          if (pubkey === myPubkey) continue;

          // Skip payloads already rejected in a previous cycle: verification
          // is deterministic, so the same payload fails the same way without
          // paying decompression + parse + hash again (or re-logging).
          const payloadSig = snapshotPayloadSig(payload);
          if (rejectedSnapshotSig.get(pubkey) === payloadSig) continue;

          try {
            // CRITICAL: peer snapshots are untrusted input. The payload is
            // decompressed, shape-validated via parseCheckpoint, hash-verified
            // (recomputed state hash must match BOTH the checkpoint body and
            // the relay-carried hash), clamped (fleet <= 5000, balance in
            // [-$10B, $10B]) and owner-bound to its signing author `pubkey`.
            // Anything that fails is DISCARDED, not ingested.
            const snapshotCheckpoint = await verifySnapshotPayload(payload, pubkey);
            if (!snapshotCheckpoint) {
              rejectedSnapshotSig.set(pubkey, payloadSig);
              worldLogger.warn(
                `Rejected invalid/unverified snapshot for competitor ${pubkey} — not ingesting.`,
              );
              continue;
            }
            rejectedSnapshotSig.delete(pubkey);
            const { airline, fleet, routes } = snapshotCheckpoint;

            // Abandoned airlines (S26): no active route and idle for a week.
            // Mostly guests who left after a minute; hidden from the world,
            // rival lists and leaderboard until they act again.
            const lastActiveTick = Math.max(airline.lastTick ?? 0, snapshotCheckpoint.tick);
            if (isAbandonedAirline(routes, lastActiveTick, currentTick)) {
              competitors.delete(pubkey);
              updatedFleetByOwner.delete(pubkey);
              updatedRoutesByOwner.delete(pubkey);
              continue;
            }

            if (airline.status === "chapter11" || airline.status === "liquidated") {
              competitors.set(pubkey, airline);
              updatedFleetByOwner.set(pubkey, fleet);
              updatedRoutesByOwner.set(pubkey, routes);
              competitorLastFullSync.set(pubkey, Date.now());
              continue; // Do not advance bankrupt airlines
            }

            // Alert if they opened a hub in our territory
            const prevComp = existingState.competitors.get(pubkey);
            for (const hub of airline.hubs) {
              if (myHubs.has(hub) && (!prevComp || !prevComp.hubs.includes(hub))) {
                newTimelineEvents.push({
                  id: `evt-comp-hub-${pubkey}-${hub}-${currentTick}`,
                  tick: currentTick,
                  timestamp: GENESIS_TIME + currentTick * TICK_DURATION,
                  type: "competitor_hub",
                  description: `Competitor ${airline.name} just opened a hub at ${hub}!`,
                });
              }
            }

            // Alert when they start flying one of our city pairs (S34).
            for (const pair of rivalRoutesNewOnYourPairs(
              existingState.routes,
              existingState.routesByOwner.get(pubkey),
              routes,
            )) {
              newTimelineEvents.push({
                id: `evt-comp-route-${pubkey}-${pair.key}-${currentTick}`,
                tick: currentTick,
                timestamp: GENESIS_TIME + currentTick * TICK_DURATION,
                type: "competitor_route",
                originIata: pair.originIata,
                destinationIata: pair.destinationIata,
                description: `Competitor ${airline.name} now flies ${pair.originIata}–${pair.destinationIata}, one of your routes.`,
              });
            }

            let finalAirline = airline;
            let finalFleet = fleet;

            if (
              currentTick > 0 &&
              finalAirline.lastTick != null &&
              currentTick > finalAirline.lastTick
            ) {
              const { fleet: projectedFleet, balanceDelta } = reconcileFleetToTick(
                fleet,
                routes,
                currentTick,
              );
              finalFleet = projectedFleet;
              finalAirline = {
                ...finalAirline,
                corporateBalance: applyMonthlyCosts(
                  fpAdd(finalAirline.corporateBalance, balanceDelta),
                  finalAirline.hubs,
                  finalFleet,
                  finalAirline.lastTick ?? 0,
                  currentTick,
                ),
                lastTick: currentTick,
              };
            }

            competitors.set(pubkey, finalAirline);
            updatedFleetByOwner.set(pubkey, finalFleet);
            updatedRoutesByOwner.set(pubkey, routes);
            competitorLastFullSync.set(pubkey, Date.now());

            // Update global route registry
            buildRouteOffers(registry, pubkey, finalAirline, finalFleet, routes);
          } catch (e) {
            worldLogger.warn(`Failed parsing snapshot for competitor ${pubkey}`, e);
          }
        }

        set({
          competitors,
          fleetByOwner: updatedFleetByOwner,
          routesByOwner: updatedRoutesByOwner,
          globalRouteRegistry: registry,
        });

        if (newTimelineEvents.length > 0 && myPubkey) {
          set({
            timeline: [...newTimelineEvents, ...existingState.timeline].slice(0, 1000),
          });
        }

        await settleMarketplaceSales(get, set);
        useEngineStore.setState({ catchupProgress: null });
        bootMark("world: synced", `${competitors.size} rivals`);
      } catch (error) {
        console.error("[WorldSlice] Failed to sync world:", error);
        useEngineStore.setState({ catchupProgress: null });
      }
    } finally {
      isSyncingWorld = false;
      if (pendingSyncWorldOptions) {
        const queuedOptions = pendingSyncWorldOptions;
        pendingSyncWorldOptions = null;
        void get().syncWorld(queuedOptions);
      }
    }
  },

  syncCompetitor: async (competitorPubkey: string, liveEvents?: ActionLogEntry[]) => {
    const now = Date.now();
    const lastFullSync = competitorLastFullSync.get(competitorPubkey) ?? 0;
    const hasLiveEvents = Array.isArray(liveEvents) && liveEvents.length > 0;

    // Full resync when there is nothing to replay incrementally, when the
    // cached state is stale (periodic refresh), or on first sight.
    if (!hasLiveEvents || now - lastFullSync >= COMPETITOR_FULL_SYNC_INTERVAL_MS) {
      competitorLastFullSync.set(competitorPubkey, now);
      return await get().syncWorld();
    }

    const state = get();
    const cachedAirline = state.competitors.get(competitorPubkey);
    if (!cachedAirline) {
      // No cached state to replay onto — fall back to a full resync.
      competitorLastFullSync.set(competitorPubkey, now);
      return await get().syncWorld();
    }
    const cachedFleet = state.fleetByOwner.get(competitorPubkey) ?? [];
    const cachedRoutes = state.routesByOwner.get(competitorPubkey) ?? [];

    const checkpoint: Checkpoint = {
      schemaVersion: 1,
      tick: cachedAirline.lastTick ?? 0,
      createdAt: now,
      actionChainHash: "",
      stateHash: "",
      airline: cachedAirline,
      fleet: cachedFleet,
      routes: cachedRoutes,
      timeline: [],
    };

    // Scope the live events to those newer than the cached state (with the
    // standard rescue rules), then replay them over the cached snapshot.
    const scoped = scopeActionsToCheckpoint(liveEvents, checkpoint);
    // Anti-double-purchase guard: relay retries can deliver two
    // AIRCRAFT_BUY_USED events for the same instance — only the earliest
    // (per canonical order) may win.
    const rejectedEventIds = computeRejectedBuyEventIds(scoped);
    try {
      const replayed = await replayActionLog({
        pubkey: competitorPubkey,
        actions: scoped.map((entry) => ({
          action: entry.action as unknown as GameActionEnvelope,
          eventId: entry.event.id,
          authorPubkey: entry.event.author.pubkey,
          createdAt: entry.event.created_at ?? null,
        })),
        checkpoint,
        rejectedEventIds,
      });

      if (!replayed.airline) {
        // Dissolved mid-stream — keep the cached state; the next full
        // resync will confirm.
        return;
      }

      const updatedCompetitors = new Map(state.competitors);
      updatedCompetitors.set(competitorPubkey, replayed.airline);
      const updatedFleetByOwner = new Map(state.fleetByOwner);
      updatedFleetByOwner.set(competitorPubkey, replayed.fleet);
      const updatedRoutesByOwner = new Map(state.routesByOwner);
      updatedRoutesByOwner.set(competitorPubkey, replayed.routes);

      // Refresh only this competitor's offers in the registry: drop their
      // old entries, then re-add from the replayed state.
      const updatedRegistry = new Map(state.globalRouteRegistry);
      for (const [key, offers] of updatedRegistry.entries()) {
        const kept = offers.filter((offer) => offer.airlinePubkey !== competitorPubkey);
        if (kept.length !== offers.length) {
          if (kept.length === 0) updatedRegistry.delete(key);
          else updatedRegistry.set(key, kept);
        }
      }
      buildRouteOffers(
        updatedRegistry,
        competitorPubkey,
        replayed.airline,
        replayed.fleet,
        replayed.routes,
      );

      set({
        competitors: updatedCompetitors,
        fleetByOwner: updatedFleetByOwner,
        routesByOwner: updatedRoutesByOwner,
        globalRouteRegistry: updatedRegistry,
      });
    } catch (e) {
      worldLogger.warn(`Incremental competitor sync failed for ${competitorPubkey}`, e);
    }
  },
});

/**
 * Seller-side marketplace settlement.
 *
 * For each aircraft in our fleet that has a `listingPrice` set, check if the
 * same instanceId now exists in a competitor's fleet (fleetByOwner). If so,
 * the buyer has claimed it — settle the transaction on our side.
 */
async function settleMarketplaceSales(
  get: () => AirlineState,
  set: (partial: Partial<AirlineState> | ((state: AirlineState) => Partial<AirlineState>)) => void,
): Promise<void> {
  const { airline: initialAirline, fleet: initialFleet, pubkey, fleetByOwner } = get();
  if (!initialAirline || !pubkey) return;

  // Competitor snapshots that list one of our aircraft are only CLAIMS
  // (snapshot bodies are publisher-authored). Collect every claimant whose
  // recorded purchasePrice matches our listing price (within 1 FP unit).
  const listed = initialFleet.filter((ac) => ac.listingPrice != null && ac.listingPrice > 0);
  if (listed.length === 0) return;
  const listedById = new Map(listed.map((ac) => [ac.id, ac]));
  const tolerance = fpRaw(1);
  const claimantsByAircraft = new Map<string, Set<string>>();
  for (const [ownerPubkey, ownerFleet] of fleetByOwner) {
    if (ownerPubkey === pubkey) continue;
    for (const claimed of ownerFleet) {
      const ours = listedById.get(claimed.id);
      if (!ours) continue;
      const priceDiff =
        claimed.purchasePrice >= ours.listingPrice!
          ? fpSub(claimed.purchasePrice, ours.listingPrice!)
          : fpSub(ours.listingPrice!, claimed.purchasePrice);
      if (priceDiff > tolerance) {
        console.warn(
          `[WorldSlice] Settlement rejected for ${ours.id}: buyer price ${fpFormat(claimed.purchasePrice)} != listing ${fpFormat(ours.listingPrice!)}`,
        );
        continue;
      }
      const set = claimantsByAircraft.get(claimed.id) ?? new Set<string>();
      set.add(ownerPubkey);
      claimantsByAircraft.set(claimed.id, set);
    }
  }
  if (claimantsByAircraft.size === 0) return;

  // A claim settles only with a buyer-signed AIRCRAFT_BUY_USED for that
  // aircraft at our price (see marketplaceSettlement.ts). Throttle repeat
  // lookups of claims that stayed unproven.
  const now = Date.now();
  const claimants = new Set<string>();
  for (const [aircraftId, owners] of claimantsByAircraft) {
    for (const owner of owners) {
      const key = `${owner}:${aircraftId}`;
      const last = unprovenClaimCheckedAt.get(key);
      if (last !== undefined && now - last < UNPROVEN_CLAIM_RECHECK_MS) continue;
      claimants.add(owner);
    }
  }
  if (claimants.size === 0) return;

  let buyActions: ActionLogEntry[];
  try {
    const { loadActionLog } = await import("@acars/nostr");
    buyActions = await loadActionLog({ authors: [...claimants], maxPages: 2 });
  } catch (e) {
    console.warn("[WorldSlice] Could not load buyer actions for settlement proof:", e);
    return;
  }
  const proven = selectProvenSales(listed, claimantsByAircraft, buyActions);
  const provenIds = new Set(proven.map((sale) => sale.aircraftId));
  for (const [aircraftId, owners] of claimantsByAircraft) {
    if (provenIds.has(aircraftId)) continue;
    for (const owner of owners) {
      if (!claimants.has(owner)) continue;
      unprovenClaimCheckedAt.set(`${owner}:${aircraftId}`, now);
      console.warn(
        `[WorldSlice] Ignoring unproven claim on listed aircraft ${aircraftId} by ${owner.slice(0, 8)}… (no matching signed purchase).`,
      );
    }
  }

  // Re-read: the action-log fetch awaited, so state may have moved on.
  const latest = get();
  const airline = latest.airline;
  if (!airline || latest.pubkey !== pubkey) return;
  const { fleet, routes, timeline } = latest;
  const soldAircraft = fleet.filter(
    (ac) => provenIds.has(ac.id) && ac.listingPrice === listedById.get(ac.id)?.listingPrice,
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

  // Snapshot of the pre-settlement state, used by the merge-safe rollback.
  const previousFleetById = new Map(fleet.map((ac) => [ac.id, ac]));
  const previousRouteById = new Map(routes.map((rt) => [rt.id, rt]));
  const addedTimelineIds = new Set(newTimelineEvents.map((evt) => evt.id));
  // Exact proceeds credited by this settlement — the rollback re-subtracts
  // this delta instead of restoring an absolute balance snapshot.
  const saleDelta = fpSub(updatedBalance, airline.corporateBalance);

  // Optimistic update
  set({
    airline: updatedAirline,
    fleet: updatedFleet,
    routes: updatedRoutes,
    timeline: finalTimeline,
  });

  // Delete marketplace listings (seller-signed, NIP-09 compliant)
  try {
    const { deleteMarketplaceListing } = await import("@acars/nostr");
    for (const sold of soldAircraft) {
      try {
        await deleteMarketplaceListing(pubkey, sold.id);
        console.info(`[WorldSlice] Published NIP-09 deletion for marketplace listing: ${sold.id}`);
      } catch (e) {
        // Non-critical: listing will be filtered by ownership verification on other clients
        console.warn(`[WorldSlice] Failed to publish deletion for listing ${sold.id}:`, e);
      }
    }
  } catch (e) {
    // Rollback on publish failure — merge-safe: revert only the settlement
    // delta instead of restoring absolute snapshots, so concurrent tick
    // updates (revenue, opex) applied meanwhile are preserved.
    console.error("[WorldSlice] Failed to publish marketplace settlement:", e);
    set((state) => {
      const restoredFleet = [...state.fleet];
      for (const sold of soldAircraft) {
        if (!restoredFleet.some((ac) => ac.id === sold.id)) {
          const previous = previousFleetById.get(sold.id);
          if (previous) restoredFleet.push(previous);
        }
      }
      const restoredRoutes = state.routes.map((rt) => {
        const previousRoute = previousRouteById.get(rt.id);
        if (!previousRoute) return rt;
        const restoredIds = [...rt.assignedAircraftIds];
        for (const sold of soldAircraft) {
          if (
            previousRoute.assignedAircraftIds.includes(sold.id) &&
            !restoredIds.includes(sold.id)
          ) {
            restoredIds.push(sold.id);
          }
        }
        return restoredIds.length === rt.assignedAircraftIds.length
          ? rt
          : { ...rt, assignedAircraftIds: restoredIds };
      });
      return {
        airline: state.airline
          ? {
              ...state.airline,
              // Re-subtract exactly the sale proceeds we credited (delta),
              // never an absolute balance snapshot.
              corporateBalance: fpSub(state.airline.corporateBalance, saleDelta),
              // Re-add the sold aircraft to fleetIds.
              fleetIds: [
                ...state.airline.fleetIds,
                ...soldAircraft
                  .map((sold) => sold.id)
                  .filter((id) => !state.airline!.fleetIds.includes(id)),
              ],
            }
          : state.airline,
        fleet: restoredFleet,
        routes: restoredRoutes,
        timeline: state.timeline.filter((evt) => !addedTimelineIds.has(evt.id)),
      };
    });
  }
}
