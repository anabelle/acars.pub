import type { FixedPoint, TimelineEvent } from "@acars/core";
import { fp, fpAdd, haversineDistance } from "@acars/core";

/** Earth's circumference at the equator, for "times round the Earth". */
export const EARTH_KM = 40_075;

export interface Logbook {
  /** Landings in the recent log (the timeline keeps the latest 1,000 events). */
  landings: number;
  passengers: number;
  distanceKm: number;
  profit: FixedPoint;
  /** Airports the plane has landed at or left from, most visited first. */
  airports: string[];
  /** Tick of the oldest landing in the recent log, if any. */
  sinceTick: number | null;
}

type Coords = { latitude: number; longitude: number };

/**
 * A plane's logbook from the recent log (S61): one pass over the timeline,
 * O(events), never per passenger. Distance comes from the airports' great
 * circle, so it does not depend on fields older events may lack.
 */
export function planeLogbook(
  aircraftId: string,
  timeline: readonly TimelineEvent[],
  airport: (iata: string) => Coords | undefined,
): Logbook {
  let landings = 0;
  let passengers = 0;
  let distanceKm = 0;
  let profit = fp(0);
  let sinceTick: number | null = null;
  const visits = new Map<string, number>();
  const visit = (iata?: string) => {
    if (iata) visits.set(iata, (visits.get(iata) ?? 0) + 1);
  };

  for (const event of timeline) {
    if (event.type !== "landing" || event.aircraftId !== aircraftId) continue;
    landings += 1;
    passengers += event.details?.passengers?.total ?? 0;
    if (event.profit !== undefined) profit = fpAdd(profit, event.profit);
    sinceTick = sinceTick === null ? event.tick : Math.min(sinceTick, event.tick);
    visit(event.originIata);
    visit(event.destinationIata);
    const from = event.originIata ? airport(event.originIata) : undefined;
    const to = event.destinationIata ? airport(event.destinationIata) : undefined;
    if (from && to) {
      distanceKm += haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
    }
  }

  const airports = [...visits.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([iata]) => iata);
  return { landings, passengers, distanceKm: Math.round(distanceKm), profit, airports, sinceTick };
}
