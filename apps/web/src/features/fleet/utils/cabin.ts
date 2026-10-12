import type { FixedPoint, TimelineEvent } from "@acars/core";
import { fp, fpAdd, fpSub, groupAt, type PassengerGroup } from "@acars/core";
import { destinationMix } from "@/features/network/utils/passengerGroups";

export type CabinClass = "first" | "business" | "economy";

export interface CabinRow {
  cls: CabinClass;
  seats: number;
  filled: number;
  /** Glyphs drawn for this class, and how many are filled. */
  glyphs: number;
  filledGlyphs: number;
}

/** Above this many seats a glyph stands for more than one seat. */
const MAX_GLYPHS = 120;

/**
 * The cabin by class (S63): seats and filled seats per class, drawn as glyphs
 * (one per seat, or one per N seats on big planes). Classes without seats are
 * left out. Never per passenger: counts in, counts out.
 */
export function cabinRows(
  configuration: { economy: number; business: number; first: number },
  passengers: { economy: number; business: number; first: number },
): { rows: CabinRow[]; seatsPerGlyph: number } {
  const total = configuration.economy + configuration.business + configuration.first;
  const seatsPerGlyph = total > MAX_GLYPHS ? Math.ceil(total / MAX_GLYPHS) : 1;
  const rows = (["first", "business", "economy"] as const)
    .filter((cls) => configuration[cls] > 0)
    .map((cls) => {
      const seats = configuration[cls];
      const filled = Math.min(seats, Math.max(0, passengers[cls]));
      const glyphs = Math.ceil(seats / seatsPerGlyph);
      return {
        cls,
        seats,
        filled,
        glyphs,
        filledGlyphs: Math.min(glyphs, Math.round(filled / seatsPerGlyph)),
      };
    });
  return { rows, seatsPerGlyph };
}

export interface ReceiptLine {
  key: string;
  amount: FixedPoint;
}

export interface Receipt {
  income: ReceiptLine[];
  costs: ReceiptLine[];
  net: FixedPoint;
}

const COST_KEYS = [
  "fuel",
  "crew",
  "maintenance",
  "airport",
  "navigation",
  "handling",
  "distribution",
  "leasing",
  "overhead",
] as const;

/**
 * A landing's receipt (S63): tickets by class and ancillary sales, then each
 * cost line the engine recorded (newer lines only when present), and the net.
 * Null when the event carries no breakdown (old events).
 */
export function landingReceipt(event: TimelineEvent): Receipt | null {
  const revenue = event.details?.revenue;
  const costs = event.details?.costs;
  if (!revenue || !costs) return null;
  const income = (["first", "business", "economy", "ancillary"] as const)
    .map((key) => ({ key, amount: revenue[key] }))
    .filter((line) => line.amount !== 0);
  const costLines: ReceiptLine[] = [];
  for (const key of COST_KEYS) {
    const amount = costs[key];
    if (amount !== undefined && amount !== 0) costLines.push({ key, amount });
  }
  const totalIncome = income.reduce((sum, line) => fpAdd(sum, line.amount), fp(0));
  const totalCost = costLines.reduce((sum, line) => fpAdd(sum, line.amount), fp(0));
  return { income, costs: costLines, net: event.profit ?? fpSub(totalIncome, totalCost) };
}

export type VoiceKey =
  | "full"
  | "roomy"
  | "first"
  | "business"
  | "smooth"
  | "holiday"
  | "family"
  | "commute";

/** The economy voice for each passenger group (S71). */
const GROUP_VOICE: Record<PassengerGroup, VoiceKey> = {
  leisure: "holiday",
  family: "family",
  business: "commute",
};

function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Now and then (about one landing in three) a passenger says something about
 * the flight, chosen from the flight's own numbers and seeded by the event id:
 * every client hears the same voice. On an ordinary flight the speaker is one
 * of the passenger groups that fly there (S71). Null when this landing stays quiet.
 */
export function passengerVoice(event: TimelineEvent): VoiceKey | null {
  if (hash(event.id) % 3 !== 0) return null;
  const pax = event.details?.passengers;
  const load = event.details?.loadFactor;
  if (!pax || load === undefined) return null;
  if (load >= 0.97) return "full";
  if (load < 0.5) return "roomy";
  if (pax.first > 0) return "first";
  if (pax.business > 0 && pax.business >= pax.total * 0.15) return "business";
  // Passenger groups (S71): an economy voice from who flies to this destination.
  if (event.destinationIata) {
    const seed = (hash(`${event.id}:group`) % 1000) / 1000;
    return GROUP_VOICE[groupAt(destinationMix(event.destinationIata), seed)];
  }
  return "smooth";
}
