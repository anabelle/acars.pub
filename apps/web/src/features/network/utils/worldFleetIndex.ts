import type { AircraftInstance } from "@acars/core";

export type FleetByOwner = ReadonlyMap<string, readonly AircraftInstance[]>;

/**
 * Module-level index `Map<airportIata, AircraftInstance[]>` derived from the
 * unified `fleetByOwner` world map. Shared by every FlightBoard / airport
 * panel so the world fleet is flattened ONCE per `fleetByOwner` reference
 * instead of once per airport per tick.
 *
 * An aircraft is registered under its base airport plus its current flight's
 * origin and destination — that is a superset of what the flight-board
 * filters need (enroute aircraft are matched by flight endpoints, grounded
 * aircraft by base).
 */
function buildIndex(
  fleetByOwner: FleetByOwner,
  excludeOwnerPubkey: string | null,
): Map<string, AircraftInstance[]> {
  const index = new Map<string, AircraftInstance[]>();
  const add = (iata: string, aircraft: AircraftInstance) => {
    const list = index.get(iata);
    if (list) {
      list.push(aircraft);
    } else {
      index.set(iata, [aircraft]);
    }
  };
  fleetByOwner.forEach((ownerFleet, ownerPubkey) => {
    if (ownerPubkey === excludeOwnerPubkey) return;
    for (const aircraft of ownerFleet) {
      // Unique keys per aircraft (base/origin/dest may coincide — e.g. a
      // turnaround aircraft whose base equals the flight origin).
      const iatas = new Set<string>();
      if (aircraft.baseAirportIata) iatas.add(aircraft.baseAirportIata);
      if (aircraft.flight) {
        if (aircraft.flight.originIata) iatas.add(aircraft.flight.originIata);
        if (aircraft.flight.destinationIata) iatas.add(aircraft.flight.destinationIata);
      }
      iatas.forEach((iata) => add(iata, aircraft));
    }
  });
  return index;
}

let indexCache: {
  fleetByOwner: FleetByOwner | null;
  excludeOwnerPubkey: string | null;
  index: Map<string, AircraftInstance[]> | null;
} = { fleetByOwner: null, excludeOwnerPubkey: null, index: null };

const EMPTY_LIST: AircraftInstance[] = [];

/**
 * Returns world (non-player) aircraft indexed by airport, i.e. all aircraft
 * whose base airport OR current flight endpoint matches the IATA. Cached on
 * the `fleetByOwner` reference — the store replaces the Map on every world
 * write, which invalidates the cache automatically.
 */
export function getWorldFleetByAirport(
  fleetByOwner: FleetByOwner,
  excludeOwnerPubkey: string | null,
): Map<string, AircraftInstance[]> {
  if (
    indexCache.fleetByOwner === fleetByOwner &&
    indexCache.excludeOwnerPubkey === excludeOwnerPubkey &&
    indexCache.index
  ) {
    return indexCache.index;
  }
  const index = buildIndex(fleetByOwner, excludeOwnerPubkey);
  indexCache = { fleetByOwner, excludeOwnerPubkey, index };
  return index;
}

/** Convenience accessor returning the (possibly empty) candidate list for an airport. */
export function getWorldFleetAtAirport(
  fleetByOwner: FleetByOwner,
  excludeOwnerPubkey: string | null,
  airportIata: string,
): readonly AircraftInstance[] {
  return getWorldFleetByAirport(fleetByOwner, excludeOwnerPubkey).get(airportIata) ?? EMPTY_LIST;
}

/** Test hook: clears the module-level cache. */
export function __resetWorldFleetIndexCacheForTests(): void {
  indexCache = { fleetByOwner: null, excludeOwnerPubkey: null, index: null };
}
