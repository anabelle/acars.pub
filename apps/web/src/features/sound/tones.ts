import type { TimelineEvent } from "@acars/core";

/** One synthesized note: frequency (Hz), start and length (s), peak gain (0–1). */
export interface Note {
  freq: number;
  start: number;
  duration: number;
  gain: number;
}

/**
 * The cabin "ding-dong" for a landing (S76): a falling major third, a little
 * higher and brighter the fuller the plane flew.
 */
export function landingChime(loadFactor: number): Note[] {
  const lf = Math.min(1, Math.max(0, loadFactor));
  const high = 660 * (0.94 + 0.12 * lf);
  return [
    { freq: high, start: 0, duration: 0.55, gain: 0.16 },
    { freq: high * 0.8, start: 0.32, duration: 0.8, gain: 0.14 },
  ];
}

/** Delivery day (S76): three rising notes and a held fifth. */
export function deliveryFanfare(): Note[] {
  return [
    { freq: 523.25, start: 0, duration: 0.22, gain: 0.14 },
    { freq: 659.25, start: 0.16, duration: 0.22, gain: 0.14 },
    { freq: 783.99, start: 0.32, duration: 0.22, gain: 0.15 },
    { freq: 1046.5, start: 0.5, duration: 0.9, gain: 0.13 },
  ];
}

/**
 * What a batch of live events sounds like: a delivery wins over landings;
 * otherwise the newest landing's chime; nothing for other events.
 */
export function soundFor(events: readonly TimelineEvent[]): Note[] | null {
  if (events.some((event) => event.type === "delivery")) return deliveryFanfare();
  const landing = events.find((event) => event.type === "landing");
  return landing ? landingChime(landing.details?.loadFactor ?? 0.8) : null;
}
