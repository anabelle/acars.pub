import type { Airport, GroupMix } from "@acars/core";
import { economyElasticity, groupMix } from "@acars/core";
import { getAirports } from "@acars/data";

// Built lazily — the airports catalog loads async after first paint.
let airportByIata: Map<string, Airport> | null = null;

/** Who flies to a destination (S71): its passenger group mix, by the airport's tag. */
export function destinationMix(destinationIata: string): GroupMix {
  if (!airportByIata || airportByIata.size === 0) {
    airportByIata = new Map(getAirports().map((airport) => [airport.iata, airport]));
  }
  return groupMix(airportByIata.get(destinationIata)?.tags?.[0]);
}

/** Economy's price elasticity on a route to this destination (S71). */
export function destinationEconomyElasticity(destinationIata: string): number {
  return economyElasticity(destinationMix(destinationIata));
}
