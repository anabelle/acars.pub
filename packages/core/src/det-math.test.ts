// ============================================================
// @acars/core — Deterministic Transcendental Math Tests
// ============================================================
// Three guarantees:
//  (a) accuracy vs the (platform) Math.* built-ins within the game's
//      operating ranges — target: relative error ≤ 1e-9,
//  (b) bit-identical results across repeated invocations,
//  (c) consistent edge-case behavior (0, negatives, NaN, ±∞).
// ============================================================

import { describe, expect, it } from "vitest";
import { detAsin, detAtan2, detCos, detExp, detLog, detLog1p, detPow, detSin } from "./det-math.js";

const REL_TOLERANCE = 1e-9;

function relativeError(actual: number, expected: number): number {
  if (expected === 0) return Math.abs(actual);
  return Math.abs((actual - expected) / expected);
}

/** Deterministic pseudo-random sample generator (mulberry32-style, no PRNG import). */
function sample(count: number, seed: number): number[] {
  let state = seed | 0;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out.push(((t ^ (t >>> 14)) >>> 0) / 4294967296);
  }
  return out;
}

describe("det-math accuracy vs Math.* (game ranges)", () => {
  it("detExp matches Math.exp on [-30, 30] within 1e-9 relative", () => {
    const xs = sample(2000, 1).map((u) => -30 + 60 * u);
    for (const x of xs) {
      expect(relativeError(detExp(x), Math.exp(x))).toBeLessThan(REL_TOLERANCE);
    }
    for (const x of [-30, -10, -1, -0.5, 0, 0.5, 1, 10, 30, 20.25, -13.75]) {
      expect(relativeError(detExp(x), Math.exp(x))).toBeLessThan(REL_TOLERANCE);
    }
  });

  it("detLog matches Math.log on [1e-6, 1e9] within 1e-9 relative", () => {
    const xs = sample(2000, 2).map((u) => Math.pow(10, -6 + 15 * u)); // log-spaced
    for (const x of xs) {
      expect(relativeError(detLog(x), Math.log(x))).toBeLessThan(REL_TOLERANCE);
    }
    for (const x of [1e-6, 1e-3, 0.5, 0.7071067811865476, 1, 1.0000000001, 2, 10, 1e6, 1e9]) {
      expect(relativeError(detLog(x), Math.log(x))).toBeLessThan(REL_TOLERANCE);
    }
  });

  it("detLog1p matches Math.log1p within 1e-9 relative", () => {
    const xs = sample(2000, 3).map((u) => -0.99 + 1.98 * u);
    for (const x of xs) {
      expect(relativeError(detLog1p(x), Math.log1p(x))).toBeLessThan(REL_TOLERANCE);
    }
    for (const x of [-0.999, -0.75, -0.25, -0.2499, 0, 1e-9, 0.25, 0.2501, 5, 1e6]) {
      expect(relativeError(detLog1p(x), Math.log1p(x))).toBeLessThan(REL_TOLERANCE);
    }
  });

  it("detSin/detCos match Math.sin/Math.cos on |x| ≤ 1000 within 1e-9", () => {
    const xs = sample(3000, 4).map((u) => -1000 + 2000 * u);
    for (const x of xs) {
      // trig results are bounded by 1, so an absolute test is the
      // conservative form of the 1e-9 budget
      expect(Math.abs(detSin(x) - Math.sin(x))).toBeLessThan(REL_TOLERANCE);
      expect(Math.abs(detCos(x) - Math.cos(x))).toBeLessThan(REL_TOLERANCE);
    }
    for (const x of [0, 1, Math.PI / 2, Math.PI, 2 * Math.PI, 100, 500.5, 999.999, -1000]) {
      expect(Math.abs(detSin(x) - Math.sin(x))).toBeLessThan(REL_TOLERANCE);
      expect(Math.abs(detCos(x) - Math.cos(x))).toBeLessThan(REL_TOLERANCE);
    }
  });

  it("detAtan2 matches Math.atan2 on all quadrants within 1e-9", () => {
    const us = sample(60, 5);
    for (const uy of us) {
      for (const ux of us) {
        const y = -10 + 20 * uy;
        const x = -10 + 20 * ux;
        if (x === 0 || y === 0) continue;
        expect(Math.abs(detAtan2(y, x) - Math.atan2(y, x))).toBeLessThan(REL_TOLERANCE);
      }
    }
    for (const [y, x] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
      [1e-6, 1],
      [1, 1e-6],
      [1e6, -3],
      [-1e-9, -1e-9],
    ] as const) {
      expect(Math.abs(detAtan2(y, x) - Math.atan2(y, x))).toBeLessThan(REL_TOLERANCE);
    }
  });

  it("detAsin matches Math.asin on [-1, 1] within 1e-9", () => {
    const xs = sample(2000, 6).map((u) => -0.999999 + 1.999998 * u);
    for (const x of xs) {
      expect(Math.abs(detAsin(x) - Math.asin(x))).toBeLessThan(REL_TOLERANCE);
    }
    for (const x of [-1, -0.99, -0.5, 0, 0.5, 0.99, 1]) {
      expect(Math.abs(detAsin(x) - Math.asin(x))).toBeLessThan(REL_TOLERANCE);
    }
  });

  it("detPow matches Math.pow for base ∈ [0.01,50], exponent ∈ [-4,4]", () => {
    const bases = sample(200, 7).map((u) => 0.01 + 49.99 * u);
    const exps = sample(50, 8).map((u) => -4 + 8 * u);
    for (const b of bases) {
      for (const e of exps) {
        expect(relativeError(detPow(b, e), Math.pow(b, e))).toBeLessThan(REL_TOLERANCE);
      }
    }
    // Game-specific exponents: population^0.8, gdp^0.6/0.3, ratio^-1.2, 0.9^t
    expect(relativeError(detPow(7_674_366, 0.8), Math.pow(7_674_366, 0.8))).toBeLessThan(
      REL_TOLERANCE,
    );
    expect(relativeError(detPow(1.2, -1.2), Math.pow(1.2, -1.2))).toBeLessThan(REL_TOLERANCE);
    expect(relativeError(detPow(0.9, 25), Math.pow(0.9, 25))).toBeLessThan(REL_TOLERANCE);
    expect(relativeError(detPow(2000, 1.1), Math.pow(2000, 1.1))).toBeLessThan(REL_TOLERANCE);
  });
});

describe("det-math determinism (bit-identical repeated invocations)", () => {
  const xs = sample(500, 42);

  it("detExp/detLog/detLog1p return identical bits on every call", () => {
    for (const u of xs) {
      const x = -30 + 60 * u;
      expect(detExp(x)).toBe(detExp(x));
      expect(detLog(1e-6 + 1e9 * u)).toBe(detLog(1e-6 + 1e9 * u));
      expect(detLog1p(-0.9 + 1.8 * u)).toBe(detLog1p(-0.9 + 1.8 * u));
    }
  });

  it("detSin/detCos/detAsin/detAtan2 return identical bits on every call", () => {
    for (const u of xs) {
      const x = -1000 + 2000 * u;
      expect(detSin(x)).toBe(detSin(x));
      expect(detCos(x)).toBe(detCos(x));
      expect(detAsin(-1 + 2 * u)).toBe(detAsin(-1 + 2 * u));
      expect(detAtan2(x, 1 - 2 * u)).toBe(detAtan2(x, 1 - 2 * u));
    }
  });

  it("detSin is exactly odd-symmetric (sign-symmetric rounding)", () => {
    for (const u of xs) {
      const x = -100 + 200 * u;
      expect(detSin(-x)).toBe(-detSin(x));
    }
  });

  it("detPow returns identical bits on every call", () => {
    for (const u of xs) {
      expect(detPow(0.01 + 50 * u, -4 + 8 * u)).toBe(detPow(0.01 + 50 * u, -4 + 8 * u));
    }
  });
});

describe("det-math edge cases", () => {
  it("detExp handles 0, ±∞ and NaN consistently", () => {
    expect(detExp(0)).toBe(1);
    expect(detExp(-0)).toBe(1);
    expect(detExp(Infinity)).toBe(Infinity);
    expect(detExp(-Infinity)).toBe(0);
    expect(detExp(NaN)).toBeNaN();
    expect(relativeError(detExp(709.782712893384), Math.exp(709.782712893384))).toBeLessThan(
      REL_TOLERANCE,
    );
    expect(detExp(710)).toBe(Infinity);
    expect(detExp(-746)).toBe(0);
  });

  it("detLog handles 0, negatives, +∞ and NaN consistently", () => {
    expect(detLog(0)).toBe(-Infinity);
    expect(detLog(-1)).toBeNaN();
    expect(detLog(-Infinity)).toBeNaN();
    expect(detLog(Infinity)).toBe(Infinity);
    expect(detLog(NaN)).toBeNaN();
    expect(detLog(1)).toBe(0);
    // detLog(2) = ln2 to double precision
    expect(detLog(2)).toBeCloseTo(0.6931471805599453, 15);
  });

  it("detLog1p handles 0, −1, out-of-domain and NaN consistently", () => {
    expect(detLog1p(0)).toBe(0);
    expect(detLog1p(-1)).toBe(-Infinity);
    expect(detLog1p(-1.5)).toBeNaN();
    expect(detLog1p(Infinity)).toBe(Infinity);
    expect(detLog1p(NaN)).toBeNaN();
  });

  it("detSin/detCos handle 0, ±∞ and NaN consistently", () => {
    expect(detSin(0)).toBe(0);
    expect(detCos(0)).toBe(1);
    expect(detSin(Infinity)).toBeNaN();
    expect(detCos(-Infinity)).toBeNaN();
    expect(detSin(NaN)).toBeNaN();
    expect(detCos(NaN)).toBeNaN();
    expect(detSin(Math.PI)).toBeCloseTo(0, 9);
    expect(detCos(Math.PI)).toBeCloseTo(-1, 9);
  });

  it("detAtan2/detAsin special cases mirror Math.*", () => {
    expect(detAtan2(0, 0)).toBe(0);
    expect(detAtan2(0, -1)).toBeCloseTo(Math.PI, 15);
    expect(detAtan2(1, 0)).toBeCloseTo(Math.PI / 2, 15);
    expect(detAtan2(-1, 0)).toBeCloseTo(-Math.PI / 2, 15);
    expect(detAtan2(NaN, 1)).toBeNaN();

    expect(detAsin(1)).toBeCloseTo(Math.PI / 2, 15);
    expect(detAsin(-1)).toBeCloseTo(-Math.PI / 2, 15);
    expect(detAsin(1.0000001)).toBeNaN();
    expect(detAsin(-1.0000001)).toBeNaN();
    expect(detAsin(NaN)).toBeNaN();
    expect(detAsin(0)).toBe(0);
  });

  it("detPow handles 0/1 bases, exact fast paths and NaN consistently", () => {
    expect(detPow(0, 0)).toBe(1);
    expect(detPow(0, 2)).toBe(0);
    expect(detPow(0, -1)).toBe(Infinity);
    expect(detPow(1, -999)).toBe(1);
    expect(detPow(1, NaN)).toBe(1); // Math.pow(1, NaN) === 1
    expect(detPow(-2, 2)).toBeNaN();
    expect(detPow(NaN, 0)).toBe(1); // Math.pow(NaN, 0) === 1
    expect(detPow(NaN, 2)).toBeNaN();
    expect(detPow(Infinity, 2)).toBe(Infinity);
    expect(detPow(Infinity, -2)).toBe(0);

    // Exact fast paths are bit-exact, not merely close.
    const b = 123.456;
    expect(detPow(b, 0)).toBe(1);
    expect(detPow(b, 1)).toBe(b);
    expect(detPow(b, 2)).toBe(b * b);
    expect(detPow(b, 0.5)).toBe(Math.sqrt(b));
    expect(detPow(b, -1)).toBe(1 / b);

    // Overflow mirrors Math.pow behavior (Infinity, callers clamp).
    expect(detPow(9e15, 20)).toBe(Infinity);
    expect(detPow(0.5, 10000)).toBe(0);
  });
});
