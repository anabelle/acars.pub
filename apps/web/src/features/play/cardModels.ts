import { TICK_DURATION } from "@acars/core";
import { legProgress, type PlaneSchedule } from "./aircraft";
import type { RouteArc } from "./arcs";

/** What the route card shows (S45.3). */
export interface RouteCardModel {
  originIata: string;
  destinationIata: string;
  ownerName: string;
  isPlayer: boolean;
  frequencyPerWeek: number;
  distanceKm: number;
}

export function routeCardModel(
  arc: RouteArc,
  nameOf: (pubkey: string) => string | undefined,
): RouteCardModel {
  return {
    originIata: arc.originIata,
    destinationIata: arc.destinationIata,
    ownerName: nameOf(arc.ownerPubkey) ?? `${arc.ownerPubkey.slice(0, 8)}…`,
    isPlayer: arc.isPlayer,
    // Routes without a schedule fly daily.
    frequencyPerWeek: arc.frequencyPerWeek ?? 7,
    distanceKm: Math.round(arc.distanceKm),
  };
}

/** What the airport card shows: how busy it is on the world's networks. */
export interface AirportCardModel {
  iata: string;
  yourRoutes: number;
  worldRoutes: number;
}

export function airportCardModel(iata: string, arcs: readonly RouteArc[]): AirportCardModel {
  let yourRoutes = 0;
  let worldRoutes = 0;
  for (const arc of arcs) {
    if (arc.originIata !== iata && arc.destinationIata !== iata) continue;
    worldRoutes++;
    if (arc.isPlayer) yourRoutes++;
  }
  return { iata, yourRoutes, worldRoutes };
}

/** What the plane card shows: a real flight's progress, or "synthetic". */
export type PlaneCardModel =
  | { synthetic: true }
  | {
      synthetic: false;
      originIata: string;
      destinationIata: string;
      isPlayer: boolean;
      progressPct: number;
      minutesLeft: number;
    };

export function planeCardModel(plane: PlaneSchedule, nowTick: number): PlaneCardModel {
  if (!plane.originIata || !plane.destinationIata) return { synthetic: true };
  return {
    synthetic: false,
    originIata: plane.originIata,
    destinationIata: plane.destinationIata,
    isPlayer: plane.isPlayer,
    progressPct: Math.round(legProgress(plane, nowTick) * 100),
    minutesLeft: Math.max(0, Math.ceil(((plane.arrivalTick - nowTick) * TICK_DURATION) / 60_000)),
  };
}
