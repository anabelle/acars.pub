import type { AircraftInstance, FixedPoint, Route, TimelineEvent } from "@acars/core";
import { fp, fpAdd, TICKS_PER_HOUR } from "@acars/core";
import { isWorking } from "@/features/fleet/utils/linePlan";
import { type OnTime, onTimePerformance } from "@/features/fleet/utils/onTime";

const DAY = TICKS_PER_HOUR * 24;
/** Fewer people than this turned away is noise, not a story. */
const TURNED_AWAY_MIN = 10;

export type Chapter =
  | { kind: "delivery"; tick: number; aircraftId: string; name: string; airport: string }
  | {
      kind: "bestFlight";
      tick: number;
      aircraftId: string;
      name: string;
      origin: string;
      destination: string;
      passengers: number;
      profit: FixedPoint;
    }
  | {
      kind: "turnedAway";
      tick: number;
      routeId: string;
      origin: string;
      destination: string;
      boarded: number;
      turnedAway: number;
    }
  | {
      kind: "parked";
      tick: number;
      aircraftId: string;
      name: string;
      airport: string;
      others: number;
    };

export interface TodayStory {
  earned: FixedPoint;
  passengers: number;
  landings: number;
  /** On-time share of scheduled flights (planes on lines, S66), when any flew. */
  onTime: OnTime | null;
  chapters: Chapter[];
}

/**
 * The check-in story of the last 24 hours (S62): what was earned and flown,
 * then a few chapters in order — deliveries, the best flight, a route that
 * turned people away — closed by what needs the player now. Only recorded
 * events and the current fleet: nothing is invented.
 */
export function buildTodayStory({
  timeline,
  fleet,
  routes,
  tick,
}: {
  timeline: readonly TimelineEvent[];
  fleet: readonly Pick<
    AircraftInstance,
    "id" | "name" | "status" | "assignedRouteId" | "baseAirportIata" | "line"
  >[];
  routes: readonly Pick<Route, "id" | "originIata" | "destinationIata">[];
  tick: number;
}): TodayStory {
  const since = tick - DAY;
  const names = new Map(fleet.map((aircraft) => [aircraft.id, aircraft.name]));
  const bases = new Map(fleet.map((aircraft) => [aircraft.id, aircraft.baseAirportIata]));
  let earned = fp(0);
  let passengers = 0;
  let landings = 0;
  let best: Extract<Chapter, { kind: "bestFlight" }> | null = null;
  const spill = new Map<string, { boarded: number; turnedAway: number; tick: number }>();
  const chapters: Chapter[] = [];

  for (const event of timeline) {
    if (event.tick <= since || event.tick > tick) continue;
    if (event.type === "delivery" && event.aircraftId && names.has(event.aircraftId)) {
      chapters.push({
        kind: "delivery",
        tick: event.tick,
        aircraftId: event.aircraftId,
        name: names.get(event.aircraftId) ?? event.aircraftName ?? "",
        airport: event.destinationIata ?? bases.get(event.aircraftId) ?? "",
      });
    }
    if (event.type !== "landing") continue;
    landings += 1;
    const pax = event.details?.passengers?.total ?? 0;
    passengers += pax;
    if (event.profit !== undefined) earned = fpAdd(earned, event.profit);
    if (
      event.aircraftId &&
      event.profit !== undefined &&
      event.profit > 0 &&
      (!best || event.profit > best.profit)
    ) {
      best = {
        kind: "bestFlight",
        tick: event.tick,
        aircraftId: event.aircraftId,
        name: names.get(event.aircraftId) ?? event.aircraftName ?? "",
        origin: event.originIata ?? "",
        destination: event.destinationIata ?? "",
        passengers: pax,
        profit: event.profit,
      };
    }
    const routeId = event.routeId ?? event.details?.routeId;
    if (routeId) {
      const entry = spill.get(routeId) ?? { boarded: 0, turnedAway: 0, tick: event.tick };
      entry.boarded += pax;
      entry.turnedAway += event.details?.spilledPassengers ?? 0;
      entry.tick = Math.max(entry.tick, event.tick);
      spill.set(routeId, entry);
    }
  }
  if (best) chapters.push(best);

  let worst: { routeId: string; boarded: number; turnedAway: number; tick: number } | null = null;
  for (const [routeId, entry] of spill) {
    if (entry.turnedAway >= TURNED_AWAY_MIN && (!worst || entry.turnedAway > worst.turnedAway)) {
      worst = { routeId, ...entry };
    }
  }
  const route = worst ? routes.find((r) => r.id === worst.routeId) : undefined;
  if (worst && route) {
    chapters.push({
      kind: "turnedAway",
      tick: worst.tick,
      routeId: worst.routeId,
      origin: route.originIata,
      destination: route.destinationIata,
      boarded: worst.boarded,
      turnedAway: worst.turnedAway,
    });
  }

  chapters.sort((a, b) => a.tick - b.tick);
  const parked = fleet.filter((a) => !isWorking(a) && a.status !== "delivery");
  if (parked.length > 0) {
    chapters.push({
      kind: "parked",
      tick,
      aircraftId: parked[0].id,
      name: parked[0].name,
      airport: parked[0].baseAirportIata,
      others: parked.length - 1,
    });
  }
  return {
    earned,
    passengers,
    landings,
    onTime: onTimePerformance(timeline, { sinceTick: since }),
    chapters: chapters.slice(-5),
  };
}
