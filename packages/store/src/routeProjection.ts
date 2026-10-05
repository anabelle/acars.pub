import type { AircraftModel, FixedPoint, FlightOffer, IncumbentOffer, Route } from "@acars/core";
import {
  calculateFlightCost,
  calculateFlightRevenue,
  calculateShares,
  fpAdd,
  fpScale,
  fpSub,
  getFuelPriceAtTick,
  getSuggestedFares,
  TICKS_PER_HOUR,
} from "@acars/core";
import {
  buildNetworkContext,
  computeFlightPassengers,
  getLegAirportFeesMultiplier,
} from "./FlightEngine.js";

/**
 * Projected economics of operating a route, computed with the same functions
 * the flight engine uses at every landing (`computeFlightPassengers`,
 * `calculateFlightRevenue`, `calculateFlightCost`, the engine's airport-fee
 * multiplier and leg timing). It is a forecast for one tick's conditions
 * (season, prosperity, fuel price), not a promise: rivals, fares and seasons
 * move. Pure and O(1) per call.
 */
export interface RouteProjectionInput {
  originIata: string;
  destinationIata: string;
  distanceKm: number;
  model: AircraftModel;
  /** Aircraft flying the route, including this one. Default 1. */
  aircraftCount?: number;
  /** Round trips a week the route is scheduled to fly (S14). Default 7, what `openRoute` stores. */
  frequencyPerWeek?: number;
  /** Defaults to the suggested fares for the distance. */
  fares?: { economy: FixedPoint; business: FixedPoint; first: FixedPoint };
  /** Seat configuration; defaults to the model's standard capacity. */
  seatConfig?: { economy: number; business: number; first: number };
  tick: number;
  /** Rival offers on the city pair (from the global route registry). */
  competitorOffers?: FlightOffer[];
  playerPubkey?: string;
  playerBrandScore?: number;
  /** The airline's tier distance limit; longer routes get half the demand. */
  distanceLimitKm?: number;
  /**
   * The airline's routes as they would be once this route is flying (include
   * the candidate route itself). The engine derives airport congestion and
   * hub demand from these, so pass them for an exact projection.
   */
  networkRoutes?: ReadonlyArray<Pick<Route, "originIata" | "destinationIata" | "frequencyPerWeek">>;
}

export interface LegProjection {
  originIata: string;
  destinationIata: string;
  passengers: { economy: number; business: number; first: number; total: number };
  seatsOffered: number;
  loadFactor: number;
  revenue: FixedPoint;
  cost: FixedPoint;
  profit: FixedPoint;
}

export interface RouteProjection {
  outbound: LegProjection;
  inbound: LegProjection;
  /** Average over both directions. */
  loadFactor: number;
  passengersPerFlight: number;
  revenuePerFlight: FixedPoint;
  costPerFlight: FixedPoint;
  profitPerFlight: FixedPoint;
  /** Round trips per week across all aircraft (the market-share frequency). */
  frequencyPerWeek: number;
  /** One-way flights per day across all aircraft. */
  flightsPerDay: number;
  revenuePerDay: FixedPoint;
  /** Operating profit per day (before lease and hub fixed costs). */
  profitPerDay: FixedPoint;
  /** Our share of economy passengers on the city pair (0–1), incumbent included. */
  marketShare: number;
  /** Rivals' economy shares, largest first. */
  competitorShares: Array<{ airlinePubkey: string; share: number }>;
  /**
   * The market's established carrier (S10): its weekly round trips and economy
   * share. Null on markets too thin to sustain one (uncontested).
   */
  incumbent: { frequencyPerWeek: number; seatsPerFlight: number; share: number } | null;
}

const PROJECTION_PUBKEY = "projection:self";

function projectLeg(
  input: Required<
    Pick<
      RouteProjectionInput,
      | "distanceKm"
      | "model"
      | "aircraftCount"
      | "fares"
      | "seatConfig"
      | "tick"
      | "frequencyPerWeek"
    >
  > &
    Pick<RouteProjectionInput, "competitorOffers" | "playerBrandScore" | "distanceLimitKm"> & {
      originIata: string;
      destinationIata: string;
      playerPubkey: string;
      network: ReturnType<typeof buildNetworkContext>;
    },
): {
  leg: LegProjection;
  frequencyPerWeek: number;
  allOffers: FlightOffer[];
  incumbent: IncumbentOffer | null;
  playersShareOfMarket: number;
} {
  const { model, seatConfig, fares, tick, distanceKm, originIata, destinationIata } = input;

  const passengers = computeFlightPassengers({
    originIata,
    destinationIata,
    tick,
    airportTraffic: input.network.airportTraffic,
    hubStates: input.network.hubStates,
    seatConfig,
    model,
    route: {
      distanceKm,
      // Only the count matters to the engine's frequency calculation.
      assignedAircraftIds: Array.from({ length: input.aircraftCount }, (_, i) => `p${i}`),
      fareEconomy: fares.economy,
      fareBusiness: fares.business,
      fareFirst: fares.first,
      frequencyPerWeek: input.frequencyPerWeek,
    },
    competitorOffers: input.competitorOffers ?? [],
    playerPubkey: input.playerPubkey,
    playerBrandScore: input.playerBrandScore ?? 0.5,
    distanceLimitKm: input.distanceLimitKm ?? Number.POSITIVE_INFINITY,
  });

  const seatsOffered = seatConfig.economy + seatConfig.business + seatConfig.first;
  const revenue = calculateFlightRevenue({
    passengersEconomy: passengers.passengersEconomy,
    passengersBusiness: passengers.passengersBusiness,
    passengersFirst: passengers.passengersFirst,
    fareEconomy: passengers.fareEconomy,
    fareBusiness: passengers.fareBusiness,
    fareFirst: passengers.fareFirst,
    seatsOffered,
  });

  // Same leg timing as the engine: duration rounded up to whole ticks.
  const durationTicks = Math.max(
    1,
    Math.ceil((distanceKm / (model.speedKmh || 800)) * TICKS_PER_HOUR),
  );
  const cost = calculateFlightCost({
    distanceKm,
    aircraft: model,
    actualPassengers: revenue.actualPassengers,
    blockHours: durationTicks / TICKS_PER_HOUR,
    airportFeesMultiplier: getLegAirportFeesMultiplier(
      originIata,
      destinationIata,
      input.network.airportTraffic,
    ),
    fuelPricePerKg: getFuelPriceAtTick(tick),
  });

  return {
    leg: {
      originIata,
      destinationIata,
      passengers: {
        economy: revenue.actualEconomy,
        business: revenue.actualBusiness,
        first: revenue.actualFirst,
        total: revenue.actualPassengers,
      },
      seatsOffered,
      loadFactor: revenue.loadFactor,
      revenue: revenue.revenueTotal,
      cost: cost.costTotal,
      profit: fpSub(revenue.revenueTotal, cost.costTotal),
    },
    frequencyPerWeek: passengers.frequencyPerWeek,
    allOffers: passengers.allOffers,
    incumbent: passengers.incumbent,
    playersShareOfMarket: passengers.playersShareOfMarket,
  };
}

/** The weekly frequency a newly opened route gets (`openRoute`). */
export const DEFAULT_FREQUENCY_PER_WEEK = 7;

export function projectRouteEconomics(input: RouteProjectionInput): RouteProjection {
  const aircraftCount = Math.max(1, input.aircraftCount ?? 1);
  const fares = input.fares ?? getSuggestedFares(input.distanceKm);
  const seatConfig = input.seatConfig ?? {
    economy: input.model.capacity.economy,
    business: input.model.capacity.business,
    first: input.model.capacity.first,
  };
  const playerPubkey = input.playerPubkey ?? PROJECTION_PUBKEY;
  const network = buildNetworkContext(input.networkRoutes ?? []);
  const frequencyPerWeek = input.frequencyPerWeek ?? DEFAULT_FREQUENCY_PER_WEEK;
  const shared = {
    ...input,
    aircraftCount,
    frequencyPerWeek,
    fares,
    seatConfig,
    playerPubkey,
    network,
  };

  const outbound = projectLeg(shared);
  const inbound = projectLeg({
    ...shared,
    originIata: input.destinationIata,
    destinationIata: input.originIata,
  });

  const revenuePerFlight = fpScale(fpAdd(outbound.leg.revenue, inbound.leg.revenue), 0.5);
  const costPerFlight = fpScale(fpAdd(outbound.leg.cost, inbound.leg.cost), 0.5);
  const profitPerFlight = fpSub(revenuePerFlight, costPerFlight);

  // Each round trip is two landings (one per direction).
  // What the route actually flies: its schedule, capped by physics (S14).
  const flownPerWeek = outbound.frequencyPerWeek;
  const flightsPerDay = (flownPerWeek * 2) / 7;

  // QSI splits what the players win from the incumbent; scale to the whole market.
  const playersShare = outbound.playersShareOfMarket;
  const shares = calculateShares(outbound.allOffers).economy;
  const competitorShares = outbound.allOffers
    .filter((offer) => offer.airlinePubkey !== playerPubkey)
    .map((offer) => ({
      airlinePubkey: offer.airlinePubkey,
      share: (shares.get(offer.airlinePubkey) ?? 0) * playersShare,
    }))
    .sort((a, b) => b.share - a.share);

  return {
    outbound: outbound.leg,
    inbound: inbound.leg,
    loadFactor: (outbound.leg.loadFactor + inbound.leg.loadFactor) / 2,
    passengersPerFlight: (outbound.leg.passengers.total + inbound.leg.passengers.total) / 2,
    revenuePerFlight,
    costPerFlight,
    profitPerFlight,
    frequencyPerWeek: flownPerWeek,
    flightsPerDay,
    revenuePerDay: fpScale(revenuePerFlight, flightsPerDay),
    profitPerDay: fpScale(profitPerFlight, flightsPerDay),
    marketShare: (shares.get(playerPubkey) ?? 0) * playersShare,
    competitorShares,
    incumbent: outbound.incumbent
      ? {
          frequencyPerWeek: outbound.incumbent.frequencyPerWeek,
          seatsPerFlight: outbound.incumbent.seatsPerFlight,
          share: 1 - playersShare,
        }
      : null,
  };
}
