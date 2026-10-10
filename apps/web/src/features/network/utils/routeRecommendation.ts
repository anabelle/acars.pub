import type { AircraftModel, FixedPoint, FlightOffer, Route } from "@acars/core";
import { fpScale, fpSub, getMaxRouteDistanceKm } from "@acars/core";
import { aircraftModels } from "@acars/data";
import { bestWeeklyFrequency, projectRouteEconomics, type RouteProjection } from "@acars/store";

/** New routes are stored with this weekly frequency (see networkSlice.openRoute). */
export const NEW_ROUTE_WEEKLY_FREQUENCY = 7;
export const DAYS_PER_LEASE_MONTH = 30;

export interface RouteRecommendation {
  model: AircraftModel;
  projection: RouteProjection;
  /** Round trips a week the projection assumes (the suggestion when none was given). */
  frequencyPerWeek: number;
  /** Operating profit per day minus the model's lease, for one aircraft. */
  profitAfterLeasePerDay: FixedPoint;
}

export interface RouteCandidateInput {
  originIata: string;
  destinationIata: string;
  distanceKm: number;
  tier: number;
  tick: number;
  brandScore: number;
  playerPubkey: string;
  competitorOffers: FlightOffer[];
  networkRoutes: ReadonlyArray<Pick<Route, "originIata" | "destinationIata" | "frequencyPerWeek">>;
  /**
   * Round trips a week the route flies (S14). Omit it for a new route: each
   * aircraft is then projected at its best frequency (S58), what launch applies.
   */
  frequencyPerWeek?: number;
  catalog?: readonly AircraftModel[];
}

/**
 * Projects the route for every aircraft the airline may fly there (unlocked
 * at its tier and in range) and recommends the cheapest one to lease that is
 * profitable after its lease. If none is profitable, returns the least bad.
 * Returns null when no unlocked aircraft has the range.
 */
export function recommendAircraftForRoute(input: RouteCandidateInput): RouteRecommendation | null {
  const catalog = input.catalog ?? aircraftModels;
  const candidates = catalog.filter(
    (model) => model.unlockTier <= input.tier && model.rangeKm >= input.distanceKm,
  );
  if (candidates.length === 0) return null;

  const options = candidates.map((model) => {
    const projectionInput = {
      originIata: input.originIata,
      destinationIata: input.destinationIata,
      distanceKm: input.distanceKm,
      model,
      tick: input.tick,
      competitorOffers: input.competitorOffers,
      playerPubkey: input.playerPubkey,
      playerBrandScore: input.brandScore,
      distanceLimitKm: getMaxRouteDistanceKm(input.tier),
      networkRoutes: input.networkRoutes,
    };
    const { frequencyPerWeek, projection } =
      input.frequencyPerWeek === undefined
        ? bestWeeklyFrequency(projectionInput)
        : {
            frequencyPerWeek: input.frequencyPerWeek,
            projection: projectRouteEconomics({
              ...projectionInput,
              frequencyPerWeek: input.frequencyPerWeek,
            }),
          };
    const leasePerDay = fpScale(model.monthlyLease, 1 / DAYS_PER_LEASE_MONTH);
    return {
      model,
      projection,
      frequencyPerWeek,
      profitAfterLeasePerDay: fpSub(projection.profitPerDay, leasePerDay),
    };
  });

  const profitable = options
    .filter((option) => option.profitAfterLeasePerDay > 0)
    .sort((a, b) => a.model.monthlyLease - b.model.monthlyLease);
  if (profitable.length > 0) return profitable[0];
  return options.sort((a, b) => b.profitAfterLeasePerDay - a.profitAfterLeasePerDay)[0];
}
