import type { PaxSegment, PaxTone } from "./PaxCrowd";

/**
 * How many figures each group gets: one figure per `perFigure` people
 * (rounded up, so a group is never invisible), scaled so the crowd never
 * exceeds `maxFigures`. Pure: the same groups always draw the same crowd.
 */
export function crowdFigures(
  segments: readonly PaxSegment[],
  perFigure = 10,
  maxFigures = 60,
): { tone: PaxTone; figures: number }[] {
  const raw = segments.map((s) => (s.count > 0 ? Math.ceil(s.count / perFigure) : 0));
  const total = raw.reduce((a, b) => a + b, 0);
  const scale = total > maxFigures ? maxFigures / total : 1;
  return segments.map((s, i) => ({
    tone: s.tone,
    figures: raw[i] === 0 ? 0 : Math.max(1, Math.floor(raw[i] * scale)),
  }));
}
