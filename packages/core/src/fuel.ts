import { fp, fpAdd, fpScale, fpSub } from "./fixed-point.js";
import { detCos, detLog } from "./det-math.js";
import { createTickPRNG } from "./prng.js";
import type { FixedPoint } from "./types.js";
import { TICKS_PER_DAY } from "./types.js";

export const FUEL_PRICE_MEAN_PER_KG = fp(1.2);
export const FUEL_PRICE_MIN_PER_KG = fp(0.8);
export const FUEL_PRICE_MAX_PER_KG = fp(1.6);
export const FUEL_PRICE_EPOCH_TICKS = TICKS_PER_DAY;

const FUEL_THETA = 0.00018;
const FUEL_SIGMA = 0.0035;

const epochCache = new Map<number, FixedPoint>([[0, FUEL_PRICE_MEAN_PER_KG]]);

function clampFuelPrice(price: FixedPoint): FixedPoint {
  if (price < FUEL_PRICE_MIN_PER_KG) return FUEL_PRICE_MIN_PER_KG;
  if (price > FUEL_PRICE_MAX_PER_KG) return FUEL_PRICE_MAX_PER_KG;
  return price;
}

function randomStandardNormal(tick: number): number {
  const prng = createTickPRNG(tick);
  const u1 = Math.max(prng(), Number.EPSILON);
  const u2 = prng();
  // sqrt is IEEE spec-exact; log/cos are deterministic det-math variants.
  return Math.sqrt(-2 * detLog(u1)) * detCos(2 * Math.PI * u2);
}

export function stepFuelPrice(currentPrice: FixedPoint, tick: number): FixedPoint {
  const drift = fpScale(fpSub(FUEL_PRICE_MEAN_PER_KG, currentPrice), FUEL_THETA);
  const shock = fp(FUEL_SIGMA * randomStandardNormal(tick));
  return clampFuelPrice(fpAdd(currentPrice, fpAdd(drift, shock)));
}

function getEpochFuelPrice(epoch: number): FixedPoint {
  const cached = epochCache.get(epoch);
  if (cached !== undefined) return cached;

  const previous = getEpochFuelPrice(epoch - 1);
  let price = previous;
  const startTick = (epoch - 1) * FUEL_PRICE_EPOCH_TICKS;
  const endTick = epoch * FUEL_PRICE_EPOCH_TICKS;

  for (let tick = startTick; tick < endTick; tick += 1) {
    price = stepFuelPrice(price, tick);
  }

  epochCache.set(epoch, price);
  return price;
}

// Per-tick memoization. getFuelPriceAtTick is pure in (tick), so the
// price series can be cached and extended incrementally instead of
// re-walking from the epoch start on every call (O(ticks) per landing →
// O(1) amortized). The cache covers a contiguous tick window
// [cacheLowTick, cacheHighTick] and is bounded to three epochs; when it
// overflows it resets to the requested tick and later lookups re-derive
// from the epoch-start prices in `epochCache`. Output is bit-identical
// to the naive epoch-walk (see fuel tests).
const FUEL_TICK_CACHE_MAX = FUEL_PRICE_EPOCH_TICKS * 3;
const tickCache = new Map<number, FixedPoint>([[0, FUEL_PRICE_MEAN_PER_KG]]);
let cacheLowTick = 0;
let cacheHighTick = 0;

function rebuildFromEpochStart(safeTick: number): FixedPoint {
  const epoch = Math.floor(safeTick / FUEL_PRICE_EPOCH_TICKS);
  const startTick = epoch * FUEL_PRICE_EPOCH_TICKS;
  let price = getEpochFuelPrice(epoch);

  tickCache.clear();
  tickCache.set(startTick, price);
  cacheLowTick = startTick;

  for (let tick = startTick; tick < safeTick; tick += 1) {
    price = stepFuelPrice(price, tick);
    tickCache.set(tick + 1, price);
  }
  cacheHighTick = safeTick;
  return price;
}

export function getFuelPriceAtTick(tick: number): FixedPoint {
  const safeTick = Math.max(0, Math.floor(tick));

  const cached = tickCache.get(safeTick);
  if (cached !== undefined) return cached;

  let price: FixedPoint;
  if (safeTick > cacheHighTick) {
    // Forward jump: advance incrementally from the highest cached tick.
    price = tickCache.get(cacheHighTick)!;
    for (let currentTick = cacheHighTick; currentTick < safeTick; currentTick += 1) {
      price = stepFuelPrice(price, currentTick);
      tickCache.set(currentTick + 1, price);
    }
    cacheHighTick = safeTick;
  } else {
    // Backward jump (rare): re-derive from the cached epoch-start state.
    price = rebuildFromEpochStart(safeTick);
  }

  if (cacheHighTick - cacheLowTick + 1 > FUEL_TICK_CACHE_MAX) {
    // Cache bound exceeded: drop everything but the current answer.
    // Future queries re-derive from `epochCache` as needed.
    tickCache.clear();
    tickCache.set(safeTick, price);
    cacheLowTick = safeTick;
    cacheHighTick = safeTick;
  }

  return price;
}

export interface FuelPriceSample {
  tick: number;
  price: FixedPoint;
}

export function getFuelPriceHistory(
  currentTick: number,
  sampleCount = 48,
  sampleSpacingTicks = 120,
): FuelPriceSample[] {
  const safeCurrentTick = Math.max(0, Math.floor(currentTick));
  const safeSampleCount = Math.max(2, Math.floor(sampleCount));
  const spacing = Math.max(1, Math.floor(sampleSpacingTicks));
  const startTick = Math.max(0, safeCurrentTick - (safeSampleCount - 1) * spacing);
  const samples: FuelPriceSample[] = [];

  for (let tick = startTick; tick <= safeCurrentTick; tick += spacing) {
    samples.push({ tick, price: getFuelPriceAtTick(tick) });
  }

  if (samples[samples.length - 1]?.tick !== safeCurrentTick) {
    samples.push({
      tick: safeCurrentTick,
      price: getFuelPriceAtTick(safeCurrentTick),
    });
  }

  return samples;
}
