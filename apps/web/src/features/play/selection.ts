import type { PlaneSchedule } from "./aircraft";
import type { NetworkAirport, RouteArc } from "./arcs";

/** What the player clicked on the prototype globe (S45.3). */
export type PlaySelection =
  | { kind: "route"; arc: RouteArc }
  | { kind: "airport"; airport: NetworkAirport }
  | { kind: "plane"; plane: PlaneSchedule };

/** deck.gl layer ids, shared by the layers and the click handler. */
export const PLAY_LAYER_IDS = {
  arcs: "play-route-arcs",
  airports: "play-airports",
  planes: "play-planes",
} as const;

/**
 * Turns a deck.gl pick into a selection. Planes come from binary data, so
 * deck.gl reports only their index into the schedule list.
 */
export function selectionFromPick(
  pick: { layerId: string | undefined; index: number; object: unknown },
  planes: readonly PlaneSchedule[],
): PlaySelection | null {
  switch (pick.layerId) {
    case PLAY_LAYER_IDS.arcs:
      return pick.object ? { kind: "route", arc: pick.object as RouteArc } : null;
    case PLAY_LAYER_IDS.airports:
      return pick.object ? { kind: "airport", airport: pick.object as NetworkAirport } : null;
    case PLAY_LAYER_IDS.planes: {
      const plane = pick.index >= 0 ? planes[pick.index] : undefined;
      return plane ? { kind: "plane", plane } : null;
    }
    default:
      return null;
  }
}

/** When several things sit under the cursor: an airport beats a plane beats a route. */
const PICK_PRIORITY: readonly string[] = [
  PLAY_LAYER_IDS.airports,
  PLAY_LAYER_IDS.planes,
  PLAY_LAYER_IDS.arcs,
];

/** The pick that wins by `PICK_PRIORITY` (null for empty space). */
export function bestPick<T extends { layerId: string | undefined }>(picks: readonly T[]): T | null {
  let best: T | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const pick of picks) {
    const rank = pick.layerId ? PICK_PRIORITY.indexOf(pick.layerId) : -1;
    if (rank >= 0 && rank < bestRank) {
      best = pick;
      bestRank = rank;
    }
  }
  return best;
}
