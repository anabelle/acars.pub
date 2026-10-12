import type { LineLeg } from "@acars/core";
import { TICKS_PER_DAY } from "@acars/core";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { formatOffset } from "../utils/linePlan";

const pct = (ticks: number) => `${(ticks / TICKS_PER_DAY) * 100}%`;

type Props = {
  legs: readonly LineLeg[];
  /** Now, as ticks after 00:00 UTC (a cyan line), when the board shows today. */
  nowOffsetTicks?: number;
  colour?: string;
  className?: string;
};

/**
 * A plane's day plan on a 24-hour board (S66): each leg a bar from its
 * scheduled departure (airport codes over it), its turnaround hatched after
 * it, the gaps between them the buffers. Legs past midnight wrap round.
 */
export function LineBoard({
  legs,
  nowOffsetTicks,
  colour = "rgb(var(--nd-magenta))",
  className,
}: Props) {
  const { t } = useTranslation("game");
  const pieces = legs.flatMap((leg, index) => {
    const start = leg.departOffsetTicks;
    const segments: { key: string; from: number; to: number; kind: "flight" | "turn" }[] = [];
    const push = (from: number, to: number, kind: "flight" | "turn") => {
      if (to <= TICKS_PER_DAY) segments.push({ key: `${index}-${kind}-${from}`, from, to, kind });
      else {
        if (from < TICKS_PER_DAY)
          segments.push({ key: `${index}-${kind}-${from}`, from, to: TICKS_PER_DAY, kind });
        segments.push({
          key: `${index}-${kind}-wrap`,
          from: Math.max(0, from - TICKS_PER_DAY),
          to: to - TICKS_PER_DAY,
          kind,
        });
      }
    };
    push(start, start + leg.durationTicks, "flight");
    push(start + leg.durationTicks, start + leg.durationTicks + leg.turnaroundTicks, "turn");
    return segments.map((s) => ({ ...s, leg }));
  });

  return (
    <div className={cn("space-y-1", className)} data-testid="line-board">
      <div
        role="img"
        aria-label={t("line.boardAria", {
          count: legs.length,
          route: legs.length
            ? [legs[0].originIata, ...legs.map((l) => l.destinationIata)].join("→")
            : "",
        })}
        className="relative h-9 rounded-[3px] border border-cockpit-line bg-cockpit-bg"
      >
        {[6, 12, 18].map((hour) => (
          <span
            key={hour}
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-cockpit-line"
            style={{ left: `${(hour / 24) * 100}%` }}
          />
        ))}
        {pieces.map((piece) =>
          piece.kind === "flight" ? (
            <span
              key={piece.key}
              data-testid="line-board-leg"
              className="absolute bottom-1.5 h-3 rounded-[2px]"
              style={{
                left: pct(piece.from),
                width: pct(piece.to - piece.from),
                background: colour,
              }}
              title={`${formatOffset(piece.leg.departOffsetTicks)}Z ${piece.leg.originIata}→${piece.leg.destinationIata}`}
            />
          ) : (
            <span
              key={piece.key}
              aria-hidden="true"
              className="absolute bottom-1.5 h-3 rounded-[2px] bg-[repeating-linear-gradient(135deg,rgb(var(--nd-white)/0.35)_0_2px,transparent_2px_4px)]"
              style={{ left: pct(piece.from), width: pct(piece.to - piece.from) }}
            />
          ),
        )}
        {legs.map((leg) => (
          <span
            key={`label-${leg.departOffsetTicks}`}
            aria-hidden="true"
            className="absolute top-0.5 font-mono text-[9px] leading-none text-muted-foreground"
            style={{ left: pct(leg.departOffsetTicks) }}
          >
            {leg.destinationIata}
          </span>
        ))}
        {nowOffsetTicks !== undefined ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 w-0.5 bg-nd-cyan"
            style={{ left: pct(nowOffsetTicks) }}
          />
        ) : null}
      </div>
      <div
        aria-hidden="true"
        className="flex justify-between font-mono text-[9px] text-muted-foreground"
      >
        <span>00Z</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24Z</span>
      </div>
    </div>
  );
}
