import type { AircraftInstance, Route } from "@acars/core";

/**
 * What a plane is doing, in one of three plain states: flying a day plan
 * (the same chain of legs every UTC day), flying one route back and forth,
 * or parked with nothing to fly. A day plan replaces the single route.
 */
export type Duty =
  | { kind: "line"; airports: string[] }
  | { kind: "route"; route: Route }
  | { kind: "parked"; airport: string };

export function aircraftDuty(
  aircraft: Pick<AircraftInstance, "assignedRouteId" | "line" | "baseAirportIata">,
  findRoute: (id: string) => Route | undefined,
): Duty {
  const legs = aircraft.line?.legs ?? [];
  if (legs.length > 0) {
    return {
      kind: "line",
      airports: [legs[0].originIata, ...legs.map((leg) => leg.destinationIata)],
    };
  }
  const route = aircraft.assignedRouteId ? findRoute(aircraft.assignedRouteId) : undefined;
  if (route) return { kind: "route", route };
  return { kind: "parked", airport: aircraft.baseAirportIata };
}
