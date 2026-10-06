import type { AircraftInstance, Airport, Route } from "@acars/core";
import { haversineDistance } from "@acars/core";
import { getAircraftById, getAirports } from "@acars/data";

/**
 * Whether an aircraft can be put on a route, and how (S25). Mirrors the
 * assignment rules in `networkSlice.assignAircraftToRoute` and the ferry
 * rules in `fleetSlice.ferryAircraft`, so the UI only offers moves the store
 * will accept.
 *
 * - `ready`: at a hub that is one of the route's endpoints; assign now.
 * - `ferry`: idle elsewhere; ferry to `ferryTo` (a hub endpoint), then assign.
 * - `blocked`: neither, with the reason.
 */
export type AssignmentOption =
  | { kind: "ready"; reassignsFrom: string | null }
  | { kind: "ferry"; ferryTo: string; ferryKm: number; reassignsFrom: string | null }
  | { kind: "blocked"; reason: AssignmentBlock };

export type AssignmentBlock =
  | "alreadyAssigned"
  | "unknownModel"
  | "outOfRange"
  | "enroute"
  | "notIdle"
  | "noHubEndpoint"
  | "ferryOutOfRange";

/** Great-circle km between two airports, or null if either is unknown. */
export type DistanceKm = (fromIata: string, toIata: string) => number | null;

export function assignmentOption(
  aircraft: AircraftInstance,
  route: Route,
  hubs: readonly string[],
  distanceKm: DistanceKm,
): AssignmentOption {
  if (aircraft.assignedRouteId === route.id) return { kind: "blocked", reason: "alreadyAssigned" };
  const model = getAircraftById(aircraft.modelId);
  if (!model) return { kind: "blocked", reason: "unknownModel" };
  if (route.distanceKm > model.rangeKm) return { kind: "blocked", reason: "outOfRange" };
  if (aircraft.status === "enroute") return { kind: "blocked", reason: "enroute" };

  const reassignsFrom = aircraft.assignedRouteId ?? null;
  const endpoints = [route.originIata, route.destinationIata];
  const base = aircraft.baseAirportIata;
  if (endpoints.includes(base) && hubs.includes(base)) return { kind: "ready", reassignsFrom };

  const hubEndpoints = endpoints.filter((iata) => hubs.includes(iata));
  if (hubEndpoints.length === 0) return { kind: "blocked", reason: "noHubEndpoint" };
  if (aircraft.status !== "idle") return { kind: "blocked", reason: "notIdle" };

  let best: { iata: string; km: number } | null = null;
  for (const iata of hubEndpoints) {
    const km = distanceKm(base, iata);
    if (km === null || km > model.rangeKm) continue;
    if (!best || km < best.km) best = { iata, km };
  }
  if (!best) return { kind: "blocked", reason: "ferryOutOfRange" };
  return { kind: "ferry", ferryTo: best.iata, ferryKm: best.km, reassignsFrom };
}

export interface AircraftCandidate {
  aircraft: AircraftInstance;
  option: AssignmentOption;
}

const rank = (option: AssignmentOption) =>
  option.kind === "ready" ? 0 : option.kind === "ferry" ? 1 : 2;

/**
 * Aircraft that could fly `route`: ready ones first (unassigned before
 * reassignments), then ferries by distance, then blocked ones (for an
 * explanation). Aircraft already on the route are left out.
 */
export function candidateAircraftForRoute(
  route: Route,
  fleet: readonly AircraftInstance[],
  hubs: readonly string[],
  distanceKm: DistanceKm,
): AircraftCandidate[] {
  return fleet
    .map((aircraft) => ({ aircraft, option: assignmentOption(aircraft, route, hubs, distanceKm) }))
    .filter(({ option }) => !(option.kind === "blocked" && option.reason === "alreadyAssigned"))
    .sort((a, b) => {
      const byKind = rank(a.option) - rank(b.option);
      if (byKind !== 0) return byKind;
      if (a.option.kind !== "blocked" && b.option.kind !== "blocked") {
        const reassign = Number(!!a.option.reassignsFrom) - Number(!!b.option.reassignsFrom);
        if (reassign !== 0) return reassign;
      }
      if (a.option.kind === "ferry" && b.option.kind === "ferry") {
        const byKm = a.option.ferryKm - b.option.ferryKm;
        if (byKm !== 0) return byKm;
      }
      return a.aircraft.name.localeCompare(b.aircraft.name);
    });
}

export interface RouteCandidate {
  route: Route;
  option: AssignmentOption;
}

/** Routes `aircraft` could fly, ready ones first, then ferries by distance, then blocked. */
export function candidateRoutesForAircraft(
  aircraft: AircraftInstance,
  routes: readonly Route[],
  hubs: readonly string[],
  distanceKm: DistanceKm,
): RouteCandidate[] {
  return routes
    .filter((route) => route.status === "active")
    .map((route) => ({ route, option: assignmentOption(aircraft, route, hubs, distanceKm) }))
    .filter(({ option }) => !(option.kind === "blocked" && option.reason === "alreadyAssigned"))
    .sort((a, b) => {
      const byKind = rank(a.option) - rank(b.option);
      if (byKind !== 0) return byKind;
      if (a.option.kind === "ferry" && b.option.kind === "ferry") {
        const byKm = a.option.ferryKm - b.option.ferryKm;
        if (byKm !== 0) return byKm;
      }
      return `${a.route.originIata}${a.route.destinationIata}`.localeCompare(
        `${b.route.originIata}${b.route.destinationIata}`,
      );
    });
}

let airportIndex: { source: Airport[]; byIata: Map<string, Airport> } | null = null;

/** {@link DistanceKm} over the loaded airports catalog (rounded km). */
export const catalogDistanceKm: DistanceKm = (fromIata, toIata) => {
  const airports = getAirports();
  if (!airportIndex || airportIndex.source !== airports) {
    airportIndex = { source: airports, byIata: new Map(airports.map((a) => [a.iata, a])) };
  }
  const from = airportIndex.byIata.get(fromIata);
  const to = airportIndex.byIata.get(toIata);
  if (!from || !to) return null;
  return Math.round(haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude));
};
