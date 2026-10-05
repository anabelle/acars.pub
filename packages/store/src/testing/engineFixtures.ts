import type { AircraftInstance, FixedPoint, FlightOffer, Route, TimelineEvent } from "@acars/core";
import { fp, getSuggestedFares } from "@acars/core";
import { getAircraftById } from "@acars/data";
import { processFlightEngine } from "../FlightEngine.js";

/**
 * Builders and drivers for running the real flight engine outside the app:
 * shared by the engine tests and the economy balance harness (S02). Callers
 * must load the airport catalog first (`setAirportsCatalog(airports)`).
 */

export const PLAYER_PUBKEY = "player-airline";

export type EngineState = {
  fleet: AircraftInstance[];
  routes: Route[];
  balance: FixedPoint;
  lastTick: number;
  events: TimelineEvent[];
};

export const makeAircraft = (overrides: Partial<AircraftInstance> = {}): AircraftInstance => {
  const modelId = overrides.modelId ?? "a320neo";
  const model = getAircraftById(modelId);
  if (!model) {
    throw new Error(`Unknown modelId: ${modelId}`);
  }

  return {
    id: overrides.id ?? "ac-1",
    ownerPubkey: overrides.ownerPubkey ?? PLAYER_PUBKEY,
    modelId,
    name: overrides.name ?? model.name,
    status: overrides.status ?? "idle",
    assignedRouteId: overrides.assignedRouteId ?? null,
    baseAirportIata: overrides.baseAirportIata ?? "JFK",
    purchasedAtTick: overrides.purchasedAtTick ?? 0,
    purchasePrice: overrides.purchasePrice ?? fp(1000000),
    birthTick: overrides.birthTick ?? 0,
    deliveryAtTick: overrides.deliveryAtTick,
    listingPrice: overrides.listingPrice ?? null,
    flight: overrides.flight ?? null,
    lastTickProcessed: overrides.lastTickProcessed,
    turnaroundEndTick: overrides.turnaroundEndTick,
    arrivalTickProcessed: overrides.arrivalTickProcessed,
    purchaseType: overrides.purchaseType ?? "buy",
    leaseStartedAtTick: overrides.leaseStartedAtTick,
    configuration: overrides.configuration ?? {
      economy: model.capacity.economy,
      business: model.capacity.business,
      first: model.capacity.first,
      cargoKg: model.capacity.cargoKg,
    },
    flightHoursTotal: overrides.flightHoursTotal ?? 0,
    flightHoursSinceCheck: overrides.flightHoursSinceCheck ?? 0,
    condition: overrides.condition ?? 1.0,
    routeAssignedAtTick: overrides.routeAssignedAtTick,
    routeAssignedAtIata: overrides.routeAssignedAtIata,
  };
};

export const makeRoute = (overrides: Partial<Route> = {}): Route => {
  const distanceKm = overrides.distanceKm ?? 1000;
  const fares = getSuggestedFares(distanceKm);

  return {
    id: overrides.id ?? "route-1",
    originIata: overrides.originIata ?? "JFK",
    destinationIata: overrides.destinationIata ?? "LAX",
    airlinePubkey: overrides.airlinePubkey ?? PLAYER_PUBKEY,
    distanceKm,
    frequencyPerWeek: overrides.frequencyPerWeek ?? 7,
    assignedAircraftIds: overrides.assignedAircraftIds ?? [],
    fareEconomy: overrides.fareEconomy ?? fares.economy,
    fareBusiness: overrides.fareBusiness ?? fares.business,
    fareFirst: overrides.fareFirst ?? fares.first,
    status: overrides.status ?? "active",
    lastTickProcessed: overrides.lastTickProcessed,
  };
};

export const initState = (
  fleet: AircraftInstance[],
  routes: Route[],
  balance: FixedPoint = fp(1000000),
): EngineState => ({
  fleet,
  routes,
  balance,
  lastTick: 0,
  events: [],
});

export const runTick = (
  state: EngineState,
  tick: number,
  options: {
    globalRouteRegistry?: Map<string, FlightOffer[]>;
    playerPubkey?: string;
    brandScore?: number;
  } = {},
): EngineState => {
  const result = processFlightEngine(
    tick,
    state.fleet,
    state.routes,
    state.balance,
    state.lastTick,
    options.globalRouteRegistry ?? new Map(),
    options.playerPubkey ?? PLAYER_PUBKEY,
    options.brandScore ?? 0.5,
    Number.POSITIVE_INFINITY,
  );

  return {
    fleet: result.updatedFleet,
    routes: state.routes,
    balance: result.corporateBalance,
    lastTick: tick,
    events: [...state.events, ...result.events],
  };
};

export const findLastEvent = (
  events: TimelineEvent[],
  type: TimelineEvent["type"],
): TimelineEvent | undefined => {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === type) return events[i];
  }
  return undefined;
};

export const simulateSingleLanding = (
  aircraft: AircraftInstance,
  route: Route,
  options: {
    globalRouteRegistry?: Map<string, FlightOffer[]>;
    brandScore?: number;
  } = {},
) => {
  let state = initState([aircraft], [route]);
  state = runTick(state, 1, options);
  const arrivalTick = state.fleet[0].flight?.arrivalTick;
  if (!arrivalTick) {
    throw new Error("Expected flight to be enroute with arrival tick");
  }
  state = runTick(state, arrivalTick, options);
  const landing = findLastEvent(state.events, "landing");
  if (!landing) {
    throw new Error("Expected landing event");
  }
  return { landing, state };
};

export const makeFlight = (
  overrides: Partial<AircraftInstance["flight"]>,
): AircraftInstance["flight"] => ({
  originIata: "JFK",
  destinationIata: "LAX",
  departureTick: 1,
  arrivalTick: 10,
  direction: "outbound",
  ...overrides,
});
