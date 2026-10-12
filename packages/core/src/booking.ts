import { TICKS_PER_HOUR } from "./types.js";

/**
 * The booking curve (S70, D13 visual first): flights fill over the hours
 * before departure, the way real ones do. Display only — revenue and the
 * replay don't use it — so plain numbers are fine here.
 */

/** Bookings that arrive in the last day before departure. */
export const BOOKING_WINDOW_TICKS = 24 * TICKS_PER_HOUR;

/** Share of a flight's final bookings sold in its last day. */
export const LATE_BOOKING_SHARE = 0.5;

/** Late shares by cabin: business travellers book latest. */
export const CLASS_LATE_SHARE = { economy: 0.4, business: 0.7, first: 0.6 } as const;

const SHAPE = 0.6;

function curve(ticksToDeparture: number, lateShare: number): number {
  if (!(ticksToDeparture > 0)) return 1;
  const x = Math.min(1, ticksToDeparture / BOOKING_WINDOW_TICKS);
  return 1 - lateShare * x ** SHAPE;
}

/** Share of a flight's final bookings already sold `ticksToDeparture` before it leaves. */
export function bookedShare(ticksToDeparture: number): number {
  return curve(ticksToDeparture, LATE_BOOKING_SHARE);
}

/** The same, for one cabin. */
export function classBookedShare(
  cabin: keyof typeof CLASS_LATE_SHARE,
  ticksToDeparture: number,
): number {
  return curve(ticksToDeparture, CLASS_LATE_SHARE[cabin]);
}
