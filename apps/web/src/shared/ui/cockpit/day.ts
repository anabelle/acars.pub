import type { DayLeg } from "./DayStrip";

/** Legs clipped to the day, with their total block hours. */
export function clipDay(legs: readonly DayLeg[]): { legs: DayLeg[]; blockHours: number } {
  const clipped: DayLeg[] = [];
  for (const leg of legs) {
    const start = Math.max(0, leg.startHour);
    const end = Math.min(24, leg.startHour + leg.durationHours);
    if (end > start) clipped.push({ startHour: start, durationHours: end - start });
  }
  return { legs: clipped, blockHours: clipped.reduce((sum, leg) => sum + leg.durationHours, 0) };
}
