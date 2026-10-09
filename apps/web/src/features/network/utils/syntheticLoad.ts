import type { AircraftInstance, Airport } from "@acars/core";
import { haversineDistance, TICKS_PER_HOUR } from "@acars/core";

/**
 * The load generator for the main globe (S56.4, ported from the S45
 * prototype): `?load=N` adds N synthetic rival aircraft in the air between
 * the busiest airports, so a perf check can put 10k or 50k planes on the
 * real map. A benchmark aid only: nothing is simulated and nothing reaches
 * the game state or the network.
 */

/** Loads the generator accepts. */
export const MAP_LOADS = [0, 1000, 10000, 50000] as const;

export function parseMapLoad(search: string): number {
  const value = Number(new URLSearchParams(search).get("load"));
  return (MAP_LOADS as readonly number[]).includes(value) ? value : 0;
}

/** Synthetic traffic flies between the busiest airports, like real traffic. */
const AIRPORT_POOL = 2000;
const SPEED_KMH = 820;
const MODELS = ["a320neo", "b737-800", "a350-900", "b787-9", "e195-e2", "atr72-600"];

/** Small deterministic PRNG (mulberry32), so a given load is the same every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `count` aircraft in the air at `nowTick`: random legs of 300–9,000 km
 * between the busiest airports, each somewhere along its leg. Built once per
 * load (O(count)); they land and stop over the following hours, which is
 * plenty for a benchmark window.
 */
export function syntheticFleet(
  count: number,
  airports: readonly Airport[],
  nowTick: number,
  seed = 56,
): AircraftInstance[] {
  if (count <= 0) return [];
  const pool = [...airports].sort((a, b) => b.population - a.population).slice(0, AIRPORT_POOL);
  if (pool.length < 2) return [];
  const random = mulberry32(seed);
  const fleet: AircraftInstance[] = [];
  for (let guard = 0; fleet.length < count && guard < count * 20; guard++) {
    const a = pool[Math.floor(random() * pool.length)];
    const b = pool[Math.floor(random() * pool.length)];
    const km = haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
    if (km < 300 || km > 9_000) continue;
    const duration = (km / SPEED_KMH) * TICKS_PER_HOUR;
    const departureTick = Math.floor(nowTick - random() * duration * 0.5);
    const index = fleet.length;
    fleet.push({
      id: `synthetic-${index}`,
      name: `SYN${index}`,
      ownerPubkey: "synthetic",
      modelId: MODELS[index % MODELS.length],
      status: "enroute",
      baseAirportIata: a.iata,
      flight: {
        originIata: a.iata,
        destinationIata: b.iata,
        departureTick,
        arrivalTick: Math.ceil(departureTick + duration),
        direction: "outbound",
      },
    } as AircraftInstance);
  }
  return fleet;
}
