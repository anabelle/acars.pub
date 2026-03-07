import type { Airport } from "@acars/core";
import { haversineDistance } from "@acars/core";
import { airports as AIRPORTS } from "./airports.js";

/**
 * Reference distance (km) used to normalise the distance penalty when
 * scoring airports outside the user's home country.  An airport this far
 * away receives half of its raw population score.
 */
const DISTANCE_REF_KM = 500;

/**
 * Find the best hub near a location, avoiding airports that already have
 * a competitor hub.
 *
 * Algorithm:
 * 1. Determine the user's country from the geographically nearest airport.
 * 2. Within that country, pick the most-populated **unoccupied** airport
 *    (distance breaks ties).
 * 3. If every airport in the country is occupied, score **all** unoccupied
 *    airports globally with `population / (1 + distance_km / 500)` so that
 *    nearby-but-smaller cities rank higher than far-away megacities.
 * 4. If every airport worldwide is occupied (or no population data exists),
 *    fall back to the original biggest-city-in-country logic.
 */
export function findPreferredHub(
  lat: number,
  lon: number,
  airports: Airport[] = AIRPORTS,
  /** IATA codes of airports that already serve as a competitor airline's hub.
   *  When provided, the algorithm prefers unoccupied airports so that new
   *  players are distributed across cities instead of clustering at the
   *  biggest airport. */
  occupiedIatas?: ReadonlySet<string>,
): Airport {
  let nearest = airports[0];
  let minDist = Infinity;
  for (const airport of airports) {
    const dist = haversineDistance(lat, lon, airport.latitude, airport.longitude);
    if (dist < minDist) {
      minDist = dist;
      nearest = airport;
    }
  }

  const country = nearest.country;
  if (country === "XX") {
    return nearest;
  }

  const occupied = occupiedIatas ?? new Set<string>();
  const countryAirports = airports.filter((a) => a.country === country);
  const populated = countryAirports.filter((a) => (a.population || 0) > 0);

  if (populated.length > 0) {
    // Sort by population descending, distance ascending as tiebreaker
    const sorted = [...populated].sort((a, b) => {
      const popDiff = (b.population || 0) - (a.population || 0);
      if (popDiff !== 0) return popDiff;
      return (
        haversineDistance(lat, lon, a.latitude, a.longitude) -
        haversineDistance(lat, lon, b.latitude, b.longitude)
      );
    });

    // Pick the first unoccupied airport in-country
    const available = sorted.find((a) => !occupied.has(a.iata));
    if (available) return available;

    // All in-country airports occupied — expand globally
    const globalCandidates = airports.filter(
      (a) => (a.population || 0) > 0 && !occupied.has(a.iata),
    );

    if (globalCandidates.length > 0) {
      let bestScore = -Infinity;
      let best = globalCandidates[0];
      for (const airport of globalCandidates) {
        const dist = haversineDistance(lat, lon, airport.latitude, airport.longitude);
        const score = (airport.population || 0) / (1 + dist / DISTANCE_REF_KM);
        if (score > bestScore) {
          bestScore = score;
          best = airport;
        }
      }
      return best;
    }

    // Every airport worldwide is occupied — fall back to biggest in-country
    return sorted[0];
  }

  return nearest;
}
