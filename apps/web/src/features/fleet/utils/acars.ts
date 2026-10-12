import type { AircraftInstance, TimelineEvent } from "@acars/core";
import { haversineDistance, TICKS_PER_HOUR } from "@acars/core";
import { formatUtcClock } from "@/features/network/utils/tickerFacts";

/** Out of the gate, off the runway, a position report, on the runway, in at the gate. */
export type AcarsKind = "OUT" | "OFF" | "POS" | "ON" | "IN";

export interface AcarsMessage {
  id: string;
  tick: number;
  kind: AcarsKind;
  aircraftId: string;
  aircraftName: string;
  /** "EEA 2134". */
  flight: string;
  origin: string;
  destination: string;
  /** The message body after the code, in ACARS style: "MAD-BCN", "40.42N 003.70W FL340". */
  body: string;
}

type Coords = { latitude: number; longitude: number };

export interface AcarsInput {
  timeline: readonly TimelineEvent[];
  fleet: readonly AircraftInstance[];
  tick: number;
  airport: (iata: string) => Coords | undefined;
  flightLabel: (aircraft: AircraftInstance) => string;
  /** Only this plane's messages. */
  aircraftId?: string;
  /** Messages kept, newest first. */
  limit?: number;
  /** How far back to read, in ticks (default 24 h). */
  windowTicks?: number;
}

const TICKS_PER_MINUTE = TICKS_PER_HOUR / 60;
/** Position reports start and stop this long after take-off and before landing. */
const POS_MARGIN = 20 * TICKS_PER_MINUTE;
/** Position reports kept per flight (the latest ones). */
const POS_PER_FLIGHT = 3;

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * Taxi time out and in (minutes → ticks), the same on every client: out 8–17
 * minutes, in 3–9, never more than a sixth of the block time each.
 */
export function taxiTicks(seed: string, blockTicks: number): { out: number; in: number } {
  const h = hash(seed);
  const cap = Math.floor(blockTicks / 6);
  return {
    out: Math.min(cap, (8 + (h % 10)) * TICKS_PER_MINUTE),
    in: Math.min(cap, (3 + ((h >>> 8) % 7)) * TICKS_PER_MINUTE),
  };
}

/** Cruise level by stage length, as a flight level ("FL340"). */
export function cruiseLevel(distanceKm: number): string {
  if (distanceKm < 400) return "FL240";
  if (distanceKm < 1200) return "FL340";
  if (distanceKm < 4000) return "FL360";
  return "FL380";
}

const deg = (value: number, width: number, pos: string, neg: string) =>
  `${Math.abs(value).toFixed(2).padStart(width, "0")}${value >= 0 ? pos : neg}`;

/** Great-circle point at fraction f between two airports. */
function along(from: Coords, to: Coords, f: number): Coords {
  const r = Math.PI / 180;
  const [lat1, lon1, lat2, lon2] = [from.latitude, from.longitude, to.latitude, to.longitude].map(
    (v) => v * r,
  );
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat1 - lat2) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon1 - lon2) / 2) ** 2,
      ),
    );
  if (d === 0) return from;
  const a = Math.sin((1 - f) * d) / Math.sin(d);
  const b = Math.sin(f * d) / Math.sin(d);
  const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
  const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
  const z = a * Math.sin(lat1) + b * Math.sin(lat2);
  return {
    latitude: Math.atan2(z, Math.sqrt(x * x + y * y)) / r,
    longitude: Math.atan2(y, x) / r,
  };
}

interface Leg {
  key: string;
  aircraft: AircraftInstance;
  origin: string;
  destination: string;
  departure: number;
  arrival: number;
  /** Landed legs carry their load for the IN message. */
  landing?: TimelineEvent;
}

function legMessages(leg: Leg, input: AcarsInput, flight: string): AcarsMessage[] {
  const { aircraft, origin, destination, departure, arrival, landing } = leg;
  const block = arrival - departure;
  const taxi = taxiTicks(leg.key, block);
  const off = departure + taxi.out;
  const on = arrival - taxi.in;
  const base = {
    aircraftId: aircraft.id,
    aircraftName: aircraft.name,
    flight,
    origin,
    destination,
  };
  const out: AcarsMessage[] = [];
  const push = (kind: AcarsKind, tick: number, body: string) => {
    if (tick <= input.tick)
      out.push({ ...base, id: `${leg.key}-${kind}-${tick}`, kind, tick, body });
  };

  const from = input.airport(origin);
  const to = input.airport(destination);
  const distanceKm =
    from && to ? haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude) : 0;

  const delayMinutes = Math.round((landing?.details?.delayTicks ?? 0) / TICKS_PER_MINUTE);
  push(
    "OUT",
    departure,
    `${origin}-${destination} ETA ${formatUtcClock(arrival)}Z${delayMinutes >= 5 ? ` DLY ${Math.floor(delayMinutes / 60)}:${String(delayMinutes % 60).padStart(2, "0")}` : ""}`,
  );
  push("OFF", off, `${origin} ${cruiseLevel(distanceKm)}`);
  if (from && to && on - off > 2 * POS_MARGIN) {
    // A report at each whole UTC hour of the cruise (GENESIS_TIME is on the hour).
    const first = Math.ceil((off + POS_MARGIN) / TICKS_PER_HOUR) * TICKS_PER_HOUR;
    const last = Math.min(on - POS_MARGIN, input.tick);
    const hours: number[] = [];
    for (let t = first; t <= last; t += TICKS_PER_HOUR) hours.push(t);
    const groundSpeed = Math.round(distanceKm / ((on - off) / TICKS_PER_HOUR) / 1.852);
    for (const t of hours.slice(-POS_PER_FLIGHT)) {
      const p = along(from, to, (t - off) / (on - off));
      push(
        "POS",
        t,
        `${deg(p.latitude, 5, "N", "S")} ${deg(p.longitude, 6, "E", "W")} ${cruiseLevel(distanceKm)} GS${groundSpeed}`,
      );
    }
  }
  push("ON", on, destination);
  if (landing) {
    const pax = landing.details?.passengers?.total;
    const lf = landing.details?.loadFactor;
    push(
      "IN",
      arrival,
      [
        destination,
        pax !== undefined ? `PAX ${pax}` : "",
        lf !== undefined ? `LF ${Math.round(lf * 100)}%` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
  return out;
}

/**
 * The airline's ACARS feed (S65): OUT/OFF/ON/IN for each leg in the window
 * and hourly position reports while cruising, all derived from the engine's
 * own landings and flights — nothing is stored or broadcast. One pass over the
 * timeline (capped at 1,000 events) plus the planes in the air; newest first.
 */
export function buildAcarsFeed(input: AcarsInput): AcarsMessage[] {
  const window = input.windowTicks ?? 24 * TICKS_PER_HOUR;
  const since = input.tick - window;
  const byId = new Map(input.fleet.map((aircraft) => [aircraft.id, aircraft]));
  const legs: Leg[] = [];

  for (const event of input.timeline) {
    if (event.type !== "landing" || !event.aircraftId) continue;
    if (input.aircraftId && event.aircraftId !== input.aircraftId) continue;
    if (event.tick < since || event.tick > input.tick) continue;
    const aircraft = byId.get(event.aircraftId);
    const duration = event.details?.flightDurationTicks;
    if (!aircraft || !event.originIata || !event.destinationIata || !duration) continue;
    legs.push({
      key: event.id,
      aircraft,
      origin: event.originIata,
      destination: event.destinationIata,
      departure: event.tick - duration,
      arrival: event.tick,
      landing: event,
    });
  }
  for (const aircraft of input.fleet) {
    if (input.aircraftId && aircraft.id !== input.aircraftId) continue;
    const flight = aircraft.flight;
    if (aircraft.status !== "enroute" || !flight || flight.departureTick > input.tick) continue;
    legs.push({
      key: `${aircraft.id}-${flight.departureTick}`,
      aircraft,
      origin: flight.originIata,
      destination: flight.destinationIata,
      departure: flight.departureTick,
      arrival: flight.arrivalTick,
    });
  }

  const messages: AcarsMessage[] = [];
  for (const leg of legs) {
    messages.push(...legMessages(leg, input, input.flightLabel(leg.aircraft)));
  }
  return messages
    .filter((m) => m.tick >= since)
    .sort((a, b) => b.tick - a.tick || a.id.localeCompare(b.id))
    .slice(0, input.limit ?? 40);
}
