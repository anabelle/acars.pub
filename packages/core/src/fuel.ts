import { detCos, detLog } from "./det-math.js";
import { fp, fpAdd, fpScale, fpSub } from "./fixed-point.js";
import { FUEL_EPOCH_START_PRICES } from "./fuelEpochs.js";
import { createTickPRNG } from "./prng.js";
import type { FixedPoint } from "./types.js";
import { TICKS_PER_DAY } from "./types.js";

export const FUEL_PRICE_MEAN_PER_KG = fp(1.2);
export const FUEL_PRICE_MIN_PER_KG = fp(0.8);
export const FUEL_PRICE_MAX_PER_KG = fp(1.6);
export const FUEL_PRICE_EPOCH_TICKS = TICKS_PER_DAY;

const FUEL_THETA = 0.00018;
const FUEL_SIGMA = 0.0035;

// Day-start prices, precomputed by scripts/generate-fuel-epochs.ts with this
// same walk: without them the first price of a session walked every tick
// since genesis (17M+ steps by late 2026; seconds on a phone, in every
// worker). Days past the table are walked and cached as before.
const epochCache = new Map<number, FixedPoint>(
  FUEL_EPOCH_START_PRICES.map((price, epoch) => [epoch, price as FixedPoint]),
);

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

// Per-day checkpoints. The first lookup in a day walks that day once from its
// day-start price and keeps every FUEL_CHECKPOINT_STRIDE-th price (an
// Int32Array: fixed-point values are small integers, so exact). Any tick is
// then at most STRIDE − 1 steps from a checkpoint, in any lookup order, and a
// day costs ~4 kB (only days actually looked up are kept).
// The earlier single-window tick cache reset whenever lookups jumped
// backwards, which world sync does constantly (each rival's missed landings
// start days in the past): it re-walked up to a day per landing and froze
// the page. Output is bit-identical to the naive walk (see fuel tests).
export const FUEL_CHECKPOINT_STRIDE = 30;
const CHECKPOINTS_PER_DAY = FUEL_PRICE_EPOCH_TICKS / FUEL_CHECKPOINT_STRIDE;
const dayCheckpoints = new Map<number, Int32Array>();

function getDayCheckpoints(epoch: number): Int32Array {
  const cached = dayCheckpoints.get(epoch);
  if (cached) return cached;
  const checkpoints = new Int32Array(CHECKPOINTS_PER_DAY);
  const startTick = epoch * FUEL_PRICE_EPOCH_TICKS;
  let price = getEpochFuelPrice(epoch);
  for (let i = 0; i < FUEL_PRICE_EPOCH_TICKS; i += 1) {
    if (i % FUEL_CHECKPOINT_STRIDE === 0) checkpoints[i / FUEL_CHECKPOINT_STRIDE] = price;
    price = stepFuelPrice(price, startTick + i);
  }
  dayCheckpoints.set(epoch, checkpoints);
  return checkpoints;
}

// The engine asks for the same tick many times in a row (every landing in a tick).
let lastTick = -1;
let lastPrice = FUEL_PRICE_MEAN_PER_KG;

export function getFuelPriceAtTick(tick: number): FixedPoint {
  const safeTick = Math.max(0, Math.floor(tick));
  if (safeTick === lastTick) return lastPrice;
  const epoch = Math.floor(safeTick / FUEL_PRICE_EPOCH_TICKS);
  const offset = safeTick - epoch * FUEL_PRICE_EPOCH_TICKS;
  const index = Math.floor(offset / FUEL_CHECKPOINT_STRIDE);
  let price = getDayCheckpoints(epoch)[index] as FixedPoint;
  for (
    let t = epoch * FUEL_PRICE_EPOCH_TICKS + index * FUEL_CHECKPOINT_STRIDE;
    t < safeTick;
    t += 1
  ) {
    price = stepFuelPrice(price, t);
  }
  lastTick = safeTick;
  lastPrice = price;
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
