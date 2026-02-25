import type { Airport } from '@airtr/core';
import { haversineDistance } from '@airtr/core';
import { airports as AIRPORTS } from './airports.js';

/**
 * Find the best hub near a location: largest city in nearest country,
 * with distance as a tie-breaker.
 */
export function findPreferredHub(lat: number, lon: number, airports: Airport[] = AIRPORTS): Airport {
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
    const countryAirports = airports.filter(a => a.country === country);
    const populated = countryAirports.filter(a => (a.population || 0) > 0);

    if (populated.length > 0) {
        let maxPopulation = 0;
        for (const airport of populated) {
            const pop = airport.population || 0;
            if (pop > maxPopulation) maxPopulation = pop;
        }

        const topByPopulation = populated.filter(a => (a.population || 0) === maxPopulation);

        let best = topByPopulation[0];
        let bestDist = Infinity;
        for (const airport of topByPopulation) {
            const dist = haversineDistance(lat, lon, airport.latitude, airport.longitude);
            if (dist < bestDist) {
                bestDist = dist;
                best = airport;
            }
        }
        return best;
    }

    return nearest;
}
