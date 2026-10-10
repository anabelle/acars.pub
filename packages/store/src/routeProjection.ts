import type { AircraftModel, FixedPoint, FlightOffer, IncumbentOffer, Route } from "@acars/core";
import {
  calculateFlightCost,
  calculateFlightRevenue,
  calculateShares,
  fpAdd,
  fpScale,
  fpSub,
  getEventFuelPriceAtTick,
  getSuggestedFares,
  legTicksFor,
  maxWeeklyFrequency,
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
      tick,
    ),
    fuelPricePerKg: getEventFuelPriceAtTick(tick),
    revenue: revenue.revenueTotal,
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

/**
 * Hours a day an aircraft's cycles may span when we suggest a frequency (S58):
 * airlines don't fly round the clock (curfews, crews, overnight checks). On a
 * one-hour sector this is about 12–13 block hours a day, the real short-haul
 * norm. The engine itself still accepts any frequency up to the physical cycle.
 */
export const OPERATING_HOURS_PER_DAY = 18;

/** Weekly frequencies tried before refining around the best (S58). */
const FREQUENCY_LADDER = [
  1, 2, 3, 4, 5, 7, 10, 14, 18, 21, 28, 35, 42, 49, 56, 70, 84, 112, 140, 168,
];

export interface FrequencySuggestion {
  /** The round trips a week that earn the most operating profit per day. */
  frequencyPerWeek: number;
  /** Most round trips a week the aircraft fly within an operating day ({@link OPERATING_HOURS_PER_DAY}). */
  maxFrequencyPerWeek: number;
  projection: RouteProjection;
}

/**
 * The weekly frequency that earns the route the most operating profit per day
 * for `aircraftCount` aircraft, within an operating day (S58). More flights
 * win market share but fly emptier, so the best is usually well above the 7 a
 * week a route opens with, and lower on thin markets. Tries a fixed ladder of frequencies, then the whole
 * numbers around the best; ties go to the fewer flights. Pure: about 25
 * projections per call, whatever the fleet size.
 */
export function bestWeeklyFrequency(input: RouteProjectionInput): FrequencySuggestion {
  const aircraftCount = Math.max(1, input.aircraftCount ?? 1);
  const legs = legTicksFor(
    input.distanceKm,
    input.model.speedKmh,
    input.model.turnaroundTimeMinutes,
  );
  const physicalMax = maxWeeklyFrequency(legs.durationTicks, legs.turnaroundTicks, aircraftCount);
  const roundTrip = 2 * (legs.durationTicks + legs.turnaroundTicks);
  const operatingMax = Math.floor(
    (OPERATING_HOURS_PER_DAY * 7 * TICKS_PER_HOUR * aircraftCount) / roundTrip,
  );
  const maxFrequencyPerWeek = Math.max(1, Math.min(physicalMax, operatingMax));
  const project = (frequencyPerWeek: number) =>
    projectRouteEconomics({
      ...input,
      aircraftCount,
      frequencyPerWeek,
      networkRoutes: input.networkRoutes?.map((route) =>
        route.originIata === input.originIata && route.destinationIata === input.destinationIata
          ? { ...route, frequencyPerWeek }
          : route,
      ),
    });

  const tried = new Map<number, RouteProjection>();
  let best = { frequencyPerWeek: 1, projection: project(1) };
  tried.set(1, best.projection);
  const consider = (frequencyPerWeek: number) => {
    if (frequencyPerWeek < 1 || frequencyPerWeek > maxFrequencyPerWeek) return;
    if (tried.has(frequencyPerWeek)) return;
    const projection = project(frequencyPerWeek);
    tried.set(frequencyPerWeek, projection);
    if (
      projection.profitPerDay > best.projection.profitPerDay ||
      (projection.profitPerDay === best.projection.profitPerDay &&
        frequencyPerWeek < best.frequencyPerWeek)
    ) {
      best = { frequencyPerWeek, projection };
    }
  };
  for (const step of FREQUENCY_LADDER) consider(step);
  consider(maxFrequencyPerWeek);
  // Refine between the ladder's neighbours of the best.
  const lower = [...tried.keys()].filter((f) => f < best.frequencyPerWeek).sort((a, b) => b - a)[0];
  const upper = [...tried.keys()].filter((f) => f > best.frequencyPerWeek).sort((a, b) => a - b)[0];
  const from = lower ?? best.frequencyPerWeek;
  const to = upper ?? best.frequencyPerWeek;
  const stride = Math.max(1, Math.ceil((to - from) / 8));
  for (let f = from + 1; f < to; f += stride) consider(f);
  return { ...best, maxFrequencyPerWeek };
}
