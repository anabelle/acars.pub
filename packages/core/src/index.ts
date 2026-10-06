// ============================================================
// @acars/core — Public API
// ============================================================

// Checkpoints
export {
  canonicalize,
  computeActionChainHash,
  computeCheckpointStateHash,
  verifyCheckpoint,
} from "./checkpoint.js";
export * from "./compression.js";
export type { CycleFlightEvent, CyclePhase } from "./cycle.js";
// Cycle
export {
  countLandingsBetween,
  enumerateFlightEvents,
  getCyclePhase,
  legTicksFor,
  MAX_ROUTE_FREQUENCY_PER_WEEK,
  MIN_ROUTE_FREQUENCY_PER_WEEK,
  maxWeeklyFrequency,
  nextDepartureTick,
  physicalRoundTripTicks,
  scheduledRoundTripTicks,
  scheduledWeeklyFrequency,
} from "./cycle.js";
// Demand
export {
  calculateBidirectionalDemand,
  calculateDemand,
  calculatePriceElasticity,
  calculateSupplyPressure,
  supplyLoadFactor,
  getHubCongestionModifier,
  getHubDemandModifier,
  getProsperityIndex,
  MAX_PRICE_ELASTICITY_MULTIPLIER,
  MIN_ADDRESSABLE_WEEKLY,
  MIN_PRICE_ELASTICITY_MULTIPLIER,
  NATURAL_LF_CEILING,
  PLAYER_MARKET_CEILING,
  PRICE_ELASTICITY_BUSINESS,
  PRICE_ELASTICITY_ECONOMY,
  PRICE_ELASTICITY_FIRST,
  scaleToAddressableMarket,
} from "./demand.js";
// Deterministic transcendental math (cross-runtime bit-identical)
export {
  detAsin,
  detAtan2,
  detCos,
  detExp,
  detLog,
  detLog1p,
  detPow,
  detSin,
} from "./det-math.js";
// Finance
export {
  calculateFlightCost,
  calculateFlightRevenue,
  calculateHubLandingFee,
  detectPriceWar,
  FARE_CAP_MULTIPLIER,
  getMaxFares,
  getSuggestedFares,
  ROUTE_SLOT_FEE,
} from "./finance.js";
// Fixed-point arithmetic
export {
  FP_SCALE,
  FP_ZERO,
  fp,
  fpAdd,
  fpDiv,
  fpFormat,
  fpMul,
  fpNeg,
  fpRaw,
  fpScale,
  fpSub,
  fpSum,
  fpToNumber,
} from "./fixed-point.js";
// Fleet
export {
  calculateBookValue,
  computeRouteFrequency,
  getMaintenanceDowntimeTicks,
} from "./fleet.js";
export {
  FUEL_PRICE_EPOCH_TICKS,
  FUEL_PRICE_MAX_PER_KG,
  FUEL_PRICE_MEAN_PER_KG,
  FUEL_PRICE_MIN_PER_KG,
  getFuelPriceAtTick,
  getFuelPriceHistory,
  stepFuelPrice,
} from "./fuel.js";
// Geography
export { haversineDistance } from "./geo.js";
// Hubs
export { buildHubState, getAirportTraffic } from "./hub.js";
// Incumbent carriers (S10)
export type { EntrantOffer, IncumbentOffer } from "./incumbent.js";
export {
  entrantMarketShare,
  getIncumbentOffer,
  INCUMBENT_FARE_SENSITIVITY,
  INCUMBENT_MIN_WEEKLY_FREQUENCY,
  INCUMBENT_TARGET_LOAD_FACTOR,
  incumbentSeatsPerFlight,
} from "./incumbent.js";
// Logging
export { createLogger } from "./logger.js";
// PRNG
export { createPRNG, createTickPRNG } from "./prng.js";
// QSI
export { allocatePassengers, calculateShares } from "./qsi.js";
// Routes
export { canonicalRouteKey } from "./route.js";
// Season
export { getSeason, getSeasonalMultiplier } from "./season.js";
export type {
  NightOverlayFeatureCollection,
  TerminatorLineCollection,
} from "./solar.js";
// Solar
export {
  computeNightOverlay,
  computeTerminatorLine,
  getSolarDeclination,
  getSubsolarPoint,
} from "./solar.js";
// Tier
export {
  estimateHistoricRevenue,
  evaluateTier,
  getMaxHubs,
  getMaxRouteDistanceKm,
  getTierProgress,
  TIER_THRESHOLDS,
  type TierProgress,
} from "./tier.js";
export type {
  AircraftInstance,
  AircraftModel,
  AirlineEntity,
  AirlineTickResult,
  Airport,
  AirportTag,
  BidirectionalDemandResult,
  Checkpoint,
  DemandResult,
  FixedPoint,
  FlightOffer,
  FlightState,
  GameActionEnvelope,
  GameActionPayload,
  GameActionType,
  HubState,
  HubTier,
  PassengerClass,
  Route,
  RouteTickResult,
  Season,
  TickResult,
  TimelineEvent,
  TimelineEventType,
} from "./types.js";
// Types
export {
  CHAPTER11_BALANCE_THRESHOLD_USD,
  GENESIS_TIME,
  REPLACEABLE_ACTION_TYPES,
  TICK_DURATION,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  TICKS_PER_MONTH,
  TICKS_PER_WEEK,
} from "./types.js";
