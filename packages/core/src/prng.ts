// ============================================================
// @acars/core — Seeded PRNG (Deterministic Random)
// ============================================================
// Uses mulberry32 — a fast, simple, deterministic 32-bit PRNG.
// Seeded by tick number to ensure identical sequences across clients.
// ============================================================

/**
 * Create a seeded pseudo-random number generator.
 * Returns a function that produces deterministic floats in [0, 1).
 */
export function createPRNG(seed: number): () => number {
  let state = seed | 0;
  return function mulberry32(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a PRNG seeded from a tick number.
 * All clients using the same tick get the same sequence.
 *
 * Math.imul computes the low 32 bits of tick·0x9E3779B1 (Knuth
 * multiplicative hash) exactly, whereas `tick * 2654435761` first forms
 * an IEEE product that silently loses bits once it exceeds 2^53
 * (~tick 3.4e9). The seed stream is bit-identical to the old formula for
 * every tick whose product is exactly representable.
 */
export function createTickPRNG(tick: number): () => number {
  return createPRNG(Math.imul(tick, 0x9e3779b1) >>> 0);
}
