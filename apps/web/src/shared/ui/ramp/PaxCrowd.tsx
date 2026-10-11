import { cn } from "@/shared/lib/utils";
import { crowdFigures } from "./crowd";

export type PaxTone = "paint" | "normal" | "caution";

export interface PaxSegment {
  /** People in this group (boarded, connecting, turned away…). */
  count: number;
  tone: PaxTone;
  /** What the group is, for screen readers ("boarded", "stayed behind"). */
  label: string;
}

const TONES: Record<PaxTone, string> = {
  paint: "rgb(var(--ramp-paint))",
  normal: "rgb(var(--nd-green))",
  caution: "rgb(var(--nd-amber))",
};

function Figure({ colour }: { colour: string }) {
  return (
    <svg width="7" height="12" viewBox="0 0 10 18" aria-hidden="true" focusable="false">
      <circle cx="5" cy="2.6" r="2.3" fill={colour} />
      <path
        d="M2 6.3 h6 v6.2 h-1.2 v5.2 h-1.4 v-4.6 h-0.8 v4.6 h-1.4 v-5.2 h-1.2 z"
        fill={colour}
      />
    </svg>
  );
}

type Props = {
  segments: readonly PaxSegment[];
  perFigure?: number;
  maxFigures?: number;
  className?: string;
};

/**
 * Passengers as airport wayfinding pictograms (S59, Blueprint §8): one figure
 * stands for `perFigure` people. Drawn from aggregates, never simulated.
 */
export function PaxCrowd({ segments, perFigure = 10, maxFigures = 60, className }: Props) {
  const groups = crowdFigures(segments, perFigure, maxFigures);
  const label = segments
    .filter((s) => s.count > 0)
    .map((s) => `${s.count.toLocaleString()} ${s.label}`)
    .join(", ");
  return (
    <span
      role="img"
      aria-label={label}
      data-testid="pax-crowd"
      className={cn("flex flex-wrap gap-0.5", className)}
    >
      {groups.flatMap((group, g) =>
        Array.from({ length: group.figures }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: figures are identical and never reorder.
          <Figure key={`${g}-${i}`} colour={TONES[group.tone]} />
        )),
      )}
    </span>
  );
}
