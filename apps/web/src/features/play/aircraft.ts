import type { AircraftInstance, Airport } from "@acars/core";
import { getGreatCircleInterpolation } from "@acars/map";
import { ARC_PEAK_RATIO, greatCircleMeters, hexToRgb, readableOnDark } from "./arcs";

/**
 * One aircraft in the air, as a schedule: where it flies and when. Positions
 * come from the schedule and the clock, so moving 50k planes is a pure O(N)
 * pass over typed arrays with no per-plane objects (S45.2).
 */
export interface PlaneSchedule {
  source: [number, number];
  target: [number, number];
  /** Fractional engine ticks. */
  departureTick: number;
  arrivalTick: number;
  /** Peak altitude of the route's arc, metres (planes ride the arcs). */
  peakMeters: number;
  color: [number, number, number, number];
  /** Synthetic planes loop their leg forever, so the load stays constant. */
  loop: boolean;
}

/** Cruise speed for synthetic legs, km/h. */
const SYNTHETIC_SPEED_KMH = 820;
const TICKS_PER_HOUR_FLOAT = 1200;

type Lookup = (iata: string) => Pick<Airport, "latitude" | "longitude"> | undefined;

/** Aircraft actually flying (status "enroute" with a flight), rivals dimmer. O(fleet). */
export function planesFromFleet(
  owners: ReadonlyArray<{
    fleet: readonly AircraftInstance[];
    colorHex: string | undefined;
    isPlayer: boolean;
  }>,
  lookupAirport: Lookup,
): PlaneSchedule[] {
  const planes: PlaneSchedule[] = [];
  for (const owner of owners) {
    const [r, g, b] = readableOnDark(hexToRgb(owner.colorHex));
    const color: [number, number, number, number] = [r, g, b, owner.isPlayer ? 255 : 150];
    for (const aircraft of owner.fleet) {
      const flight = aircraft.flight;
      if (aircraft.status !== "enroute" || !flight) continue;
      const origin = lookupAirport(flight.originIata);
      const destination = lookupAirport(flight.destinationIata);
      if (!origin || !destination) continue;
      const source: [number, number] = [origin.longitude, origin.latitude];
      const target: [number, number] = [destination.longitude, destination.latitude];
      planes.push({
        source,
        target,
        departureTick: flight.departureTick,
        arrivalTick: flight.arrivalTick,
        peakMeters: greatCircleMeters(source, target) * ARC_PEAK_RATIO,
        color,
        loop: false,
      });
    }
  }
  return planes;
}

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
 * `count` synthetic flights between the given airports (the load generator):
 * random pairs 300–9000 km apart, each starting at a random point of its leg
 * and looping, so the sky always holds exactly `count` planes.
 */
export function syntheticPlanes(
  count: number,
  airports: ReadonlyArray<Pick<Airport, "latitude" | "longitude">>,
  nowTick: number,
  seed = 45,
): PlaneSchedule[] {
  if (airports.length < 2 || count <= 0) return [];
  const random = mulberry32(seed);
  const planes: PlaneSchedule[] = [];
  let guard = 0;
  while (planes.length < count && guard < count * 20) {
    guard++;
    const a = airports[Math.floor(random() * airports.length)];
    const b = airports[Math.floor(random() * airports.length)];
    const source: [number, number] = [a.longitude, a.latitude];
    const target: [number, number] = [b.longitude, b.latitude];
    const meters = greatCircleMeters(source, target);
    if (meters < 300_000 || meters > 9_000_000) continue;
    const durationTicks = (meters / 1000 / SYNTHETIC_SPEED_KMH) * TICKS_PER_HOUR_FLOAT;
    const departureTick = nowTick - random() * durationTicks;
    const hue = random();
    planes.push({
      source,
      target,
      departureTick,
      arrivalTick: departureTick + durationTicks,
      peakMeters: meters * ARC_PEAK_RATIO,
      color: [Math.round(120 + 135 * hue), 200, Math.round(255 - 100 * hue), 200],
      loop: true,
    });
  }
  return planes;
}

/** Typed buffers deck.gl reads directly (binary attributes). */
export interface PlaneBuffers {
  length: number;
  positions: Float32Array;
  colors: Uint8Array;
}

export function allocatePlaneBuffers(planes: readonly PlaneSchedule[]): PlaneBuffers {
  const colors = new Uint8Array(planes.length * 4);
  planes.forEach((plane, i) => colors.set(plane.color, i * 4));
  return {
    length: planes.length,
    positions: new Float32Array(planes.length * 3),
    colors,
  };
}

/** Progress along the leg at `nowTick`, 0–1 (looping planes wrap). */
export function legProgress(plane: PlaneSchedule, nowTick: number): number {
  const duration = plane.arrivalTick - plane.departureTick;
  if (duration <= 0) return 1;
  const raw = (nowTick - plane.departureTick) / duration;
  if (plane.loop) return raw - Math.floor(raw);
  return Math.min(1, Math.max(0, raw));
}

/**
 * Writes every plane's position ([lng, lat, metres], riding its route's arc)
 * into the buffers for `nowTick`. O(N), no allocation per plane beyond the
 * interpolation's tuple.
 */
export function writePlanePositions(
  planes: readonly PlaneSchedule[],
  nowTick: number,
  buffers: PlaneBuffers,
): void {
  for (let i = 0; i < planes.length; i++) {
    const plane = planes[i];
    const f = legProgress(plane, nowTick);
    const here = getGreatCircleInterpolation(plane.source, plane.target, f);
    buffers.positions[i * 3] = here[0];
    buffers.positions[i * 3 + 1] = here[1];
    buffers.positions[i * 3 + 2] = Math.sin(Math.PI * f) * plane.peakMeters;
  }
}
