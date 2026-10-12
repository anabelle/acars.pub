import type { AirportTag } from "./types.js";

/**
 * Passenger groups (S71, D14 "three light types"): holiday-makers chase
 * price, families visiting relatives are steadier, business travellers pay
 * for the seat. A route's mix comes from where it goes (the destination's
 * primary tag, as for seasons) and sets how price-sensitive its economy
 * cabin is — one number per route, never a passenger at a time.
 */
export type PassengerGroup = "leisure" | "family" | "business";

export const PASSENGER_GROUPS: readonly PassengerGroup[] = ["leisure", "family", "business"];

/** Price elasticity of each group's demand. */
export const GROUP_ELASTICITY: Record<PassengerGroup, number> = {
  leisure: -1.6,
  family: -1.0,
  business: -0.5,
};

export type GroupMix = Record<PassengerGroup, number>;

const MIXES: Record<AirportTag, GroupMix> = {
  beach: { leisure: 0.7, family: 0.2, business: 0.1 },
  ski: { leisure: 0.7, family: 0.2, business: 0.1 },
  business: { leisure: 0.25, family: 0.3, business: 0.45 },
  general: { leisure: 0.45, family: 0.4, business: 0.15 },
};

/** Who flies to a destination with this tag (shares sum to 1). */
export function groupMix(destinationTag: AirportTag | undefined): GroupMix {
  return MIXES[destinationTag ?? "general"] ?? MIXES.general;
}

/** The economy cabin's price elasticity: the mix's weighted elasticity. */
export function economyElasticity(mix: GroupMix): number {
  let total = 0;
  for (const group of PASSENGER_GROUPS) total += mix[group] * GROUP_ELASTICITY[group];
  return Math.round(total * 1000) / 1000;
}

/** The group with the biggest share (ties go to the first listed). */
export function dominantGroup(mix: GroupMix): PassengerGroup {
  let best: PassengerGroup = PASSENGER_GROUPS[0];
  for (const group of PASSENGER_GROUPS) if (mix[group] > mix[best]) best = group;
  return best;
}

/**
 * A group for one voice or one seat, picked deterministically from the mix
 * by a seed in [0, 1).
 */
export function groupAt(mix: GroupMix, seed: number): PassengerGroup {
  let edge = 0;
  for (const group of PASSENGER_GROUPS) {
    edge += mix[group];
    if (seed < edge) return group;
  }
  return PASSENGER_GROUPS[PASSENGER_GROUPS.length - 1];
}
