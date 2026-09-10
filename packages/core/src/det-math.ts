// ============================================================
// @acars/core — Deterministic Transcendental Math
// ============================================================
// ECMAScript `Math.exp/log/sin/cos/pow/**` are *implementation-
// approximated*: different engines (V8/JSC/SpiderMonkey) may return
// results that differ by a few ulps. Any of those functions reachable
// from the money/state chain is a guaranteed cross-client desync.
//
// Everything below is built exclusively from IEEE-754 spec-exact
// operations (+, -, *, /, comparisons, integer ops, Math.round,
// Math.abs, Math.sqrt, Math.imul) plus fixed iteration counts, so the
// output is bit-identical on every runtime by specification.
//
// All constants are decimal literals (never computed via Math.* at
// runtime). Series truncation errors are ≤ ~1e-13 relative, far inside
// the game's 1e-9 accuracy budget for x ∈ [-30,30] (exp),
// x ∈ [1e-6,1e9] (log), |x| ≤ 1000 rad (trig), base ∈ [0.01,50],
// exponent ∈ [-4,4] (pow).
// ============================================================

// --- Constants (high-precision decimal literals) ---

/** ln(2) high part: first 32 significant bits (fdlibm ln2_hi). */
const LN2_HI = 6.9314718036912381649e-1;
/** ln(2) low part (fdlibm ln2_lo). */
const LN2_LO = 1.90821492927058770002e-10;
/** ln(2) as a plain double literal (used only to pick k). */
const LN2 = 6.9314718036912381649e-1;

/** π/2 high part: first 33 significant bits (fdlibm pio2_1). */
const PIO2_1 = 1.57079632673412561417;
/** π/2 low part (fdlibm pio2_1t). */
const PIO2_1T = 6.07710050650619224932e-11;

const PI = 3.141592653589793;
const PI_OVER_2 = 1.5707963267948966;
const PI_OVER_6 = 0.5235987755982988;
const SQRT3 = 1.7320508075688772;
/** tan(π/12) = 2 − √3 — atan argument-reduction threshold. */
const ATAN_REDUCE_THRESHOLD = 0.2679491924311227;
/** 1/√2 — log argument-normalization threshold. */
const INV_SQRT2 = 0.7071067811865476;

/** exp overflow/underflow thresholds (ln of DBL_MAX / smallest subnormal). */
const EXP_OVERFLOW = 709.782712893384;
const EXP_UNDERFLOW = -745.1332191019411;

// --- Bit-level helpers (DataView bit casts are spec-exact) ---

const fp64Buffer = new ArrayBuffer(8);
const fp64View = new DataView(fp64Buffer);

/** Exact 2^k for integer k (Infinity above DBL_MAX, 0 below smallest subnormal). */
function pow2(k: number): number {
  if (k > 1023) return Infinity;
  if (k < -1074) return 0;
  if (k >= -1022) {
    fp64View.setBigUint64(0, BigInt(k + 1023) << 52n);
    return fp64View.getFloat64(0);
  }
  // Subnormal range: product of two exact normal powers of two
  // (IEEE multiplication is correctly rounded → deterministic).
  return pow2(k + 54) * pow2(-54);
}

/**
 * Decompose a finite positive x into f · 2^e with f ∈ [1/√2, 1).
 * Manual frexp via bit extraction — no Math.* approximation involved.
 */
function splitMantissaExponent(x: number): { fraction: number; exponent: number } {
  fp64View.setFloat64(0, x);
  let bits = fp64View.getBigUint64(0);
  let scale = 0;

  if (((bits >> 52n) & 0x7ffn) === 0n) {
    // Subnormal: scale up by 2^54 (exact) and compensate the exponent.
    scale = -54;
    fp64View.setFloat64(0, x * 18014398509481984); // 2^54
    bits = fp64View.getBigUint64(0);
  }

  const exponentField = Number((bits >> 52n) & 0x7ffn);
  fp64View.setBigUint64(0, (bits & 0x800fffffffffffffn) | 0x3fe0000000000000n);
  let fraction = fp64View.getFloat64(0); // ∈ [0.5, 1)

  let exponent = exponentField - 1022 + scale;
  if (fraction < INV_SQRT2) {
    fraction *= 2; // exact
    exponent -= 1;
  }
  return { fraction, exponent }; // fraction ∈ [1/√2, 1)
}

// --- Series cores (fixed term counts, Horner evaluation) ---
//
// Coefficient tables are module-level constants (fixed length = fixed
// term count). horner() applies them high-order-first, producing the
// exact same operation sequence as a hand-written nested Horner form.

/** Horner scheme over an ascending-power coefficient table. */
function horner(coeffs: readonly number[], x: number): number {
  let acc = coeffs[coeffs.length - 1];
  for (let i = coeffs.length - 2; i >= 0; i -= 1) {
    acc = coeffs[i] + x * acc;
  }
  return acc;
}

// exp(r) = Σ r^k / k!  through k = 13 (|r| ≤ ln2/2 → error < 1e-17).
const EXP_COEFFS = [
  1, 1, 0.5, 0.16666666666666666, 0.041666666666666664, 0.008333333333333333, 0.001388888888888889,
  1.984126984126984e-4, 2.48015873015873e-5, 2.7557319223985893e-6, 2.755731922398589e-7,
  2.505210838544172e-8, 2.08767569878681e-9, 1.6059043836821613e-10,
];

// sin(r)/r as a polynomial in u = r²: 1 − u/3! + u²/5! − … + u⁶/13!.
const SIN_COEFFS = [
  1, -0.16666666666666666, 0.008333333333333333, -1.9841269841269841e-4, 2.7557319223985893e-6,
  -2.505210838544172e-8, 1.6059043836821613e-10,
];

// cos(r) as a polynomial in u = r²: 1 − u/2! + u²/4! − … − u⁷/14!.
const COS_COEFFS = [
  1, -0.5, 0.041666666666666664, -0.0013888888888888889, 2.48015873015873e-5, -2.755731922398589e-7,
  2.08767569878681e-9, -1.1470745597729725e-11,
];

// atan(u)/u as a polynomial in v = u²: 1 − v/3 + v²/5 − … + v¹²/25
// (|u| ≤ tan(π/12) ≈ 0.268 → error < 1e-16).
const ATAN_COEFFS = [
  1, -0.3333333333333333, 0.2, -0.14285714285714285, 0.1111111111111111, -0.09090909090909091,
  0.07692307692307693, -0.06666666666666667, 0.058823529411764705, -0.05263157894736842,
  0.047619047619047616, -0.043478260869565216, 0.04,
];

// log(f) = 2·(s + s³/3 + s⁵/5 + … + s²¹/21), s = (f−1)/(f+1),
// |s| ≤ 0.1716 for f ∈ [1/√2, 1) — as a polynomial in v = s².
const LOG_COEFFS = [
  2, 0.6666666666666666, 0.4, 0.2857142857142857, 0.2222222222222222, 0.18181818181818182,
  0.15384615384615385, 0.13333333333333333, 0.11764705882352941, 0.10526315789473684,
  0.09523809523809523,
];

// log(1+x)/x as a polynomial in x: 1 − x/2 + x²/3 − … + x¹⁸/19
// (|x| ≤ 0.25 → error < 1e-13).
const LOG1P_COEFFS = [
  1, -0.5, 0.3333333333333333, -0.25, 0.2, -0.16666666666666666, 0.14285714285714285, -0.125,
  0.1111111111111111, -0.1, 0.09090909090909091, -0.08333333333333333, 0.07692307692307693,
  -0.07142857142857142, 0.06666666666666667, -0.0625, 0.058823529411764705, -0.05555555555555555,
  0.05263157894736842,
];

/** exp(r) for |r| ≤ ln2/2 via Taylor through r^13/13!. */
function expPoly(r: number): number {
  return horner(EXP_COEFFS, r);
}

/** sin(r) for |r| ≤ π/4 via Taylor through r^13/13! (odd polynomial). */
function sinPoly(r: number): number {
  return r * horner(SIN_COEFFS, r * r);
}

/** cos(r) for |r| ≤ π/4 via Taylor through r^14/14! (even polynomial). */
function cosPoly(r: number): number {
  return horner(COS_COEFFS, r * r);
}

/** atan(u) for |u| ≤ tan(π/12) via series through u^25/25. */
function atanPoly(u: number): number {
  return u * horner(ATAN_COEFFS, u * u);
}

/**
 * log(f) for f ∈ [1/√2, 1) via the atanh transform:
 * s = (f−1)/(f+1), |s| ≤ 0.1716; log(f) = 2·(s + s³/3 + … + s²¹/21).
 */
function logPoly(f: number): number {
  const s = (f - 1) / (f + 1);
  return s * horner(LOG_COEFFS, s * s);
}

// --- Public API ---

/**
 * Deterministic e^x. Range reduction x = k·ln2 + r (Cody–Waite two-part
 * ln2, k = round(x/ln2)), fixed 13-term Taylor on r, exact scaling by 2^k.
 * Mirrors Math.exp on edge cases: NaN→NaN, +∞→+∞, −∞→0.
 */
export function detExp(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x > EXP_OVERFLOW) return Infinity;
  if (x < EXP_UNDERFLOW) return 0;
  if (x === 0) return 1;

  const k = Math.round(x / LN2);
  const r = x - k * LN2_HI - k * LN2_LO;
  const poly = expPoly(r);
  if (k > 1023) {
    // 2^1024 is not representable: scale in two exact steps
    // (exp(x) itself can still be finite when k rounds up to 1024).
    return poly * pow2(k - 1) * 2;
  }
  return poly * pow2(k);
}

/**
 * Deterministic natural logarithm for x > 0. Manual frexp via bit
 * extraction: x = f·2^e with f ∈ [1/√2, 1); result = e·ln2split + poly(f).
 * Mirrors Math.log on edge cases: 0→−∞, negative→NaN, +∞→+∞.
 */
export function detLog(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;

  const { fraction, exponent } = splitMantissaExponent(x);
  return exponent * LN2_HI + (exponent * LN2_LO + logPoly(fraction));
}

/**
 * Deterministic log(1+x) for x > −1. For |x| ≤ 0.25 a direct fixed-term
 * series (no 1+x rounding error); otherwise detLog(1+x).
 * Mirrors Math.log1p on edge cases: NaN→NaN, −1→−∞, <−1→NaN, +∞→+∞.
 */
export function detLog1p(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === -1) return -Infinity;
  if (x < -1) return NaN;
  if (x === Infinity) return Infinity;
  if (x === 0) return 0;

  if (x > 0.25 || x < -0.25) {
    return detLog(1 + x);
  }

  // Direct alternating series through x^19/19.
  return x * horner(LOG1P_COEFFS, x);
}

/** Deterministic sine. Cody–Waite reduction mod π/2, quadrant symmetry, fixed Taylor. */
export function detSin(x: number): number {
  if (Number.isNaN(x) || !Number.isFinite(x)) return NaN;

  const n = Math.round(x / PI_OVER_2);
  const r = x - n * PIO2_1 - n * PIO2_1T;
  const quadrant = ((n % 4) + 4) % 4;

  if (quadrant === 0) return sinPoly(r);
  if (quadrant === 1) return cosPoly(r);
  if (quadrant === 2) return -sinPoly(r);
  return -cosPoly(r);
}

/** Deterministic cosine. Cody–Waite reduction mod π/2, quadrant symmetry, fixed Taylor. */
export function detCos(x: number): number {
  if (Number.isNaN(x) || !Number.isFinite(x)) return NaN;

  const n = Math.round(x / PI_OVER_2);
  const r = x - n * PIO2_1 - n * PIO2_1T;
  const quadrant = ((n % 4) + 4) % 4;

  if (quadrant === 0) return cosPoly(r);
  if (quadrant === 1) return -sinPoly(r);
  if (quadrant === 2) return -cosPoly(r);
  return sinPoly(r);
}

/** Deterministic atan for any finite x (helper for detAtan2/detAsin). */
export function detAtan(x: number): number {
  if (Number.isNaN(x)) return NaN;

  const negative = x < 0;
  const a = negative ? -x : x;

  let result: number;
  if (a > 1) {
    // atan(a) = π/2 − atan(1/a)
    result = PI_OVER_2 - detAtan(1 / a);
  } else if (a > ATAN_REDUCE_THRESHOLD) {
    // atan(a) = π/6 + atan((√3·a − 1)/(√3 + a)); new arg ∈ [−tan(π/12), tan(π/12)]
    result = PI_OVER_6 + detAtan((SQRT3 * a - 1) / (SQRT3 + a));
  } else {
    result = atanPoly(a);
  }

  return negative ? -result : result;
}

/**
 * Deterministic atan2(y, x) mirroring Math.atan2 quadrant semantics.
 * Special cases: (±0,+0)→0, y=0 & x<0→π, x=0→±π/2.
 */
export function detAtan2(y: number, x: number): number {
  if (Number.isNaN(y) || Number.isNaN(x)) return NaN;

  if (y === 0) {
    if (x >= 0) return 0;
    return PI;
  }
  if (x === 0) {
    return y > 0 ? PI_OVER_2 : -PI_OVER_2;
  }

  const t = detAtan(Math.abs(y / x));
  if (x > 0) {
    return y > 0 ? t : -t;
  }
  return y > 0 ? PI - t : -(PI - t);
}

/**
 * Deterministic arcsin via asin(x) = atan2(x, √(1−x²)).
 * (√ and the multiply are IEEE-exact-rounded, hence deterministic.)
 * Mirrors Math.asin: |x| > 1 → NaN, ±1 → ±π/2.
 */
export function detAsin(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x > 1 || x < -1) return NaN;
  if (x === 1) return PI_OVER_2;
  if (x === -1) return -PI_OVER_2;

  return detAtan2(x, Math.sqrt(1 - x * x));
}

/**
 * Deterministic pow for the game's economic exponents.
 * b > 0: detExp(e·detLog(b)) — relative error ≲ 1e-15 vs Math.pow.
 * Exact fast paths for e ∈ {0, 1, 2, 0.5, −1} (spec-exact results).
 * b = 0: e > 0 → 0, e ≤ 0 → Infinity. b < 0 → NaN (game never raises
 * a negative base; kept consistent rather than integer-aware).
 */
export function detPow(base: number, exponent: number): number {
  // Special-case precedence mirrors Math.pow: pow(anything, 0) = 1 and
  // pow(1, anything) = 1 win over NaN propagation.
  if (exponent === 0) return 1;
  if (base === 1) return 1;
  if (Number.isNaN(base) || Number.isNaN(exponent)) return NaN;
  if (base === 0) {
    return exponent > 0 ? 0 : Infinity;
  }
  if (base < 0) return NaN;
  if (base === Infinity) {
    return exponent > 0 ? Infinity : 0;
  }

  if (exponent === 1) return base;
  if (exponent === 2) return base * base;
  if (exponent === 0.5) return Math.sqrt(base);
  if (exponent === -1) return 1 / base;

  return detExp(exponent * detLog(base));
}
