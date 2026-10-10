import {
  type Airport,
  canonicalRouteKey,
  type FlightOffer,
  fpToNumber,
  getMaxRouteDistanceKm,
  haversineDistance,
  type Route,
  TICKS_PER_HOUR,
} from "@acars/core";
import {
  NEW_ROUTE_WEEKLY_FREQUENCY,
  recommendAircraftForRoute,
} from "@/features/network/utils/routeRecommendation";

/**
 * Opportunity map from a hub (S43): projected profit per day for the best
 * unserved destinations, the same figure the Opportunities list shows (the
 * recommended aircraft's operating profit after its lease). Heavy enough to
 * run in a worker (see workers/opportunities.ts); pure so it can be tested.
 */

/** Destinations projected per hub: the most populous in range. */
export const OPPORTUNITY_DESTINATIONS = 60;
/** Shorter hops than this aren't worth a flight. */
export const OPPORTUNITY_MIN_KM = 200;

export type NetworkRoute = Pick<Route, "originIata" | "destinationIata" | "frequencyPerWeek">;

export interface HubOpportunityInput {
  hubIata: string;
  tier: number;
  tick: number;
  brandScore: number;
  playerPubkey: string;
  /** The airline's routes (served destinations are skipped). */
  routes: readonly NetworkRoute[];
  /** Rival offers by canonical route key (the global route registry). */
  registry: ReadonlyMap<string, FlightOffer[]>;
  limit?: number;
}

export interface HubOpportunity {
  iata: string;
  latitude: number;
  longitude: number;
  /** Projected profit per day after lease, in dollars (display only). */
  profitPerDay: number;
  modelName: string;
}

/** Results are reused within one game hour for the same hub and network. */
export function opportunityCacheKey(
  input: Pick<HubOpportunityInput, "hubIata" | "tick" | "routes">,
) {
  const network = input.routes
    .map((r) => `${r.originIata}-${r.destinationIata}x${r.frequencyPerWeek ?? 7}`)
    .sort()
    .join(",");
  return `${input.hubIata}:${Math.floor(input.tick / TICKS_PER_HOUR)}:${network}`;
}

/** The most populous airports in the tier's range from `hub`, not yet served from it. */
export function candidateDestinations(
  hub: Airport,
  airports: readonly Airport[],
  tier: number,
  served: ReadonlySet<string>,
  limit = OPPORTUNITY_DESTINATIONS,
): Array<{ airport: Airport; distanceKm: number }> {
  const maxKm = getMaxRouteDistanceKm(tier);
  const inRange: Array<{ airport: Airport; distanceKm: number }> = [];
  for (const airport of airports) {
    if (airport.iata === hub.iata || served.has(airport.iata)) continue;
    const distanceKm = haversineDistance(
      hub.latitude,
      hub.longitude,
      airport.latitude,
      airport.longitude,
    );
    if (distanceKm < OPPORTUNITY_MIN_KM || distanceKm > maxKm) continue;
    inRange.push({ airport, distanceKm });
  }
  return inRange
    .sort(
      (a, b) =>
        b.airport.population - a.airport.population || a.airport.iata.localeCompare(b.airport.iata),
    )
    .slice(0, limit);
}

/** Projected profit per day for each candidate destination, best first. */
export function computeHubOpportunities(
  input: HubOpportunityInput,
  airports: readonly Airport[],
): HubOpportunity[] {
  const hub = airports.find((a) => a.iata === input.hubIata);
  if (!hub) return [];
  const served = new Set(
    input.routes.filter((r) => r.originIata === hub.iata).map((r) => r.destinationIata),
  );
  const opportunities: HubOpportunity[] = [];
  for (const { airport, distanceKm } of candidateDestinations(
    hub,
    airports,
    input.tier,
    served,
    input.limit,
  )) {
    const recommendation = recommendAircraftForRoute({
      originIata: hub.iata,
      destinationIata: airport.iata,
      distanceKm,
      tier: input.tier,
      tick: input.tick,
      brandScore: input.brandScore,
      playerPubkey: input.playerPubkey,
      competitorOffers: input.registry.get(canonicalRouteKey(hub.iata, airport.iata)) ?? [],
      networkRoutes: [
        ...input.routes,
        {
          originIata: hub.iata,
          destinationIata: airport.iata,
          frequencyPerWeek: NEW_ROUTE_WEEKLY_FREQUENCY,
        },
      ],
    });
    if (!recommendation) continue;
    opportunities.push({
      iata: airport.iata,
      latitude: airport.latitude,
      longitude: airport.longitude,
      profitPerDay: Math.round(fpToNumber(recommendation.profitAfterLeasePerDay)),
      modelName: recommendation.model.name,
    });
  }
  return opportunities.sort(
    (a, b) => b.profitPerDay - a.profitPerDay || a.iata.localeCompare(b.iata),
  );
}

/** A small least-recently-used cache (per hub + hour + network). */
export class OpportunityCache {
  private readonly entries = new Map<string, HubOpportunity[]>();
  private readonly capacity: number;

  constructor(capacity = 8) {
    this.capacity = capacity;
  }

  get(key: string): HubOpportunity[] | undefined {
    const value = this.entries.get(key);
    if (value) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: HubOpportunity[]): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
