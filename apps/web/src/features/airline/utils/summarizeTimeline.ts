import type { FixedPoint, Route, TimelineEvent } from "@acars/core";
import { fp, fpAdd, fpSub } from "@acars/core";

/** The store keeps at most this many timeline events (newest first). */
export const TIMELINE_CAPACITY = 1000;

export interface RouteResult {
  routeId: string | null;
  originIata: string;
  destinationIata: string;
  flights: number;
  passengers: number;
  profit: FixedPoint;
}

export interface TimelineSummary {
  fromTick: number;
  toTick: number;
  /** Landings in the window (one per flight leg). */
  flights: number;
  passengers: number;
  revenue: FixedPoint;
  /** Flight costs plus lease payments. */
  costs: FixedPoint;
  profit: FixedPoint;
  leasePayments: FixedPoint;
  bestRoute: RouteResult | null;
  /** Lowest-profit route; null unless at least two routes flew. */
  worstRoute: RouteResult | null;
  /** Distinct aircraft that raised a grounding (safety) alert. */
  groundedAircraft: { id: string; name: string }[];
  deliveries: number;
  /** Highest tier reached in the window, if the airline was promoted. */
  newTier: number | null;
  /** Routes where the player's undercutting started a price war ("ORG-DST"). */
  priceWarRoutes: string[];
  bankrupt: boolean;
  /**
   * False when the capped timeline may have dropped the window's oldest
   * events, so the totals cover only the most recent part of the absence.
   */
  complete: boolean;
  /** Oldest tick actually covered (>= fromTick). */
  coveredFromTick: number;
}

const GROUNDED_ID_PREFIX = "evt-grounded-";
const TIER_UP_ID = /^evt-tier-up-(\d+)-/;

const passengersOf = (event: TimelineEvent) => event.details?.passengers?.total ?? 0;

/**
 * Story of what happened between two ticks, for the "while you were away"
 * report. One pass over the timeline (O(events)); money stays fixed-point.
 * `events` is the store's timeline, in any order.
 */
export function summarizeTimeline(
  events: readonly TimelineEvent[],
  fromTick: number,
  toTick: number,
  capacity: number = TIMELINE_CAPACITY,
  /** The airline's routes: label each as the player opened it (origin ⇄ destination). */
  airlineRoutes: readonly Pick<Route, "id" | "originIata" | "destinationIata">[] = [],
): TimelineSummary {
  const routeById = new Map(airlineRoutes.map((route) => [route.id, route]));
  let flights = 0;
  let passengers = 0;
  let revenue = fp(0);
  let costs = fp(0);
  let leasePayments = fp(0);
  let deliveries = 0;
  let newTier: number | null = null;
  let bankrupt = false;
  let oldestTick = Number.POSITIVE_INFINITY;
  const routes = new Map<string, RouteResult>();
  const grounded = new Map<string, string>();
  const priceWars = new Set<string>();

  for (const event of events) {
    if (event.tick < oldestTick) oldestTick = event.tick;
    if (event.tick <= fromTick || event.tick > toTick) continue;

    switch (event.type) {
      case "landing": {
        flights += 1;
        const pax = passengersOf(event);
        passengers += pax;
        revenue = fpAdd(revenue, event.revenue ?? fp(0));
        costs = fpAdd(costs, event.cost ?? fp(0));
        const routeId = event.routeId ?? event.details?.routeId ?? null;
        const known = routeId ? routeById.get(routeId) : undefined;
        const origin = known?.originIata ?? event.originIata ?? "";
        const destination = known?.destinationIata ?? event.destinationIata ?? "";
        const key = routeId ?? `${origin}-${destination}`;
        const route = routes.get(key);
        const legProfit = event.profit ?? fpSub(event.revenue ?? fp(0), event.cost ?? fp(0));
        if (route) {
          route.flights += 1;
          route.passengers += pax;
          route.profit = fpAdd(route.profit, legProfit);
        } else {
          routes.set(key, {
            routeId,
            originIata: origin,
            destinationIata: destination,
            flights: 1,
            passengers: pax,
            profit: legProfit,
          });
        }
        break;
      }
      case "lease_payment":
        leasePayments = fpAdd(leasePayments, event.cost ?? fp(0));
        costs = fpAdd(costs, event.cost ?? fp(0));
        break;
      case "maintenance":
        if (event.id.startsWith(GROUNDED_ID_PREFIX) && event.aircraftId) {
          grounded.set(event.aircraftId, event.aircraftName ?? event.aircraftId);
        }
        break;
      case "delivery":
        deliveries += 1;
        break;
      case "tier_upgrade": {
        const tier = Number(TIER_UP_ID.exec(event.id)?.[1]);
        if (Number.isFinite(tier) && (newTier === null || tier > newTier)) newTier = tier;
        break;
      }
      case "price_war": {
        const match = /on ([A-Z0-9]{3,4}-[A-Z0-9]{3,4})/.exec(event.description);
        if (match) priceWars.add(match[1]);
        break;
      }
      case "bankruptcy":
        bankrupt = true;
        break;
      default:
        break;
    }
  }

  let bestRoute: RouteResult | null = null;
  let worstRoute: RouteResult | null = null;
  for (const route of routes.values()) {
    if (!bestRoute || route.profit > bestRoute.profit) bestRoute = route;
    if (!worstRoute || route.profit < worstRoute.profit) worstRoute = route;
  }
  if (routes.size < 2) worstRoute = null;

  const complete = events.length < capacity || oldestTick <= fromTick;

  return {
    fromTick,
    toTick,
    flights,
    passengers,
    revenue,
    costs,
    profit: fpSub(revenue, costs),
    leasePayments,
    bestRoute,
    worstRoute,
    groundedAircraft: [...grounded].map(([id, name]) => ({ id, name })),
    deliveries,
    newTier,
    priceWarRoutes: [...priceWars],
    bankrupt,
    complete,
    coveredFromTick: complete ? fromTick : Math.max(fromTick, oldestTick),
  };
}
