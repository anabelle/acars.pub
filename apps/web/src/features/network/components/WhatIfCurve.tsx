import { fp, fpFormat } from "@acars/core";
import type { Curve } from "@acars/store";
import { type MouseEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { CHART_H, CHART_W, nearestPoint, plotCurve, pointAt } from "../utils/whatIf";

const money = (dollars: number) =>
  `${dollars >= 0 ? "+" : "−"}${fpFormat(fp(Math.abs(Math.round(dollars))), 0)}`;

type Props = {
  curve: Curve;
  /** How an x value reads: "18/wk", "120 %". */
  formatX: (x: number) => string;
  /** Moves the decision to x (sets a draft; nothing is published here). */
  onPick?: (x: number) => void;
  /** Label of the one-tap button to the best point. */
  pickBestLabel?: (x: string) => string;
  testId?: string;
  className?: string;
};

/**
 * A what-if curve (S64): profit per day against one decision, the sweet spot
 * in green, where the route is now in cyan and the planes' maximum in amber.
 * Hover or tap reads any point; tapping it moves the draft there.
 */
export function WhatIfCurve({ curve, formatX, onPick, pickBestLabel, testId, className }: Props) {
  const { t } = useTranslation("game");
  const plot = useMemo(() => plotCurve(curve), [curve]);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const best = pointAt(plot.points, curve.best);
  const now = pointAt(plot.points, curve.current);
  const active = (hoverX !== null ? pointAt(plot.points, hoverX) : undefined) ?? best;
  if (!best || !active) return null;

  const fromEvent = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return nearestPoint(plot.points, ((event.clientX - box.left) / box.width) * CHART_W);
  };

  return (
    <figure
      data-testid={testId}
      className={cn(
        "flex w-72 max-w-full flex-col gap-1.5 rounded-[3px] border border-cockpit-line bg-cockpit-bg p-2.5",
        className,
      )}
    >
      <figcaption className="flex items-baseline justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <span>{t("whatIf.title")}</span>
        <span className="flex gap-2 font-normal normal-case tracking-normal">
          <span className="text-nd-green">● {t("whatIf.best")}</span>
          {now ? <span className="text-nd-cyan">┃ {t("whatIf.now")}</span> : null}
          {curve.max !== undefined ? (
            <span className="text-nd-amber">┆ {t("whatIf.max")}</span>
          ) : null}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-24 w-full touch-none select-none"
        role="img"
        aria-label={t("whatIf.aria", {
          best: formatX(best.x),
          profit: money(best.profitPerDay),
          now: now ? formatX(now.x) : "—",
          nowProfit: now ? money(now.profitPerDay) : "—",
        })}
        onPointerMove={(event) => setHoverX(fromEvent(event).x)}
        onPointerLeave={() => setHoverX(null)}
        onClick={onPick ? (event) => onPick(fromEvent(event).x) : undefined}
      >
        {plot.zeroY !== null ? (
          <line
            x1={0}
            x2={CHART_W}
            y1={plot.zeroY}
            y2={plot.zeroY}
            stroke="rgb(var(--cockpit-line))"
            strokeDasharray="3 3"
          />
        ) : null}
        {curve.max !== undefined ? (
          <line
            data-mark="max"
            x1={plot.xToPx(curve.max)}
            x2={plot.xToPx(curve.max)}
            y1={4}
            y2={CHART_H - 4}
            stroke="rgb(var(--nd-amber))"
            strokeDasharray="2 3"
            strokeWidth={1.5}
          />
        ) : null}
        {now ? (
          <line
            data-mark="now"
            x1={now.px}
            x2={now.px}
            y1={4}
            y2={CHART_H - 4}
            stroke="rgb(var(--nd-cyan))"
            strokeWidth={1.5}
          />
        ) : null}
        <path
          d={plot.path}
          fill="none"
          stroke="rgb(var(--nd-magenta))"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hoverX !== null ? (
          <line
            x1={active.px}
            x2={active.px}
            y1={4}
            y2={CHART_H - 4}
            stroke="rgb(var(--nd-white))"
            strokeOpacity={0.35}
          />
        ) : null}
        <circle
          data-mark="best"
          cx={best.px}
          cy={best.py}
          r={4.5}
          fill="rgb(var(--nd-green))"
          stroke="rgb(var(--cockpit-bg))"
          strokeWidth={2}
        />
        {hoverX !== null && active !== best ? (
          <circle
            cx={active.px}
            cy={active.py}
            r={4}
            fill="rgb(var(--nd-white))"
            stroke="rgb(var(--cockpit-bg))"
            strokeWidth={2}
          />
        ) : null}
      </svg>
      <p data-testid="what-if-readout" aria-live="polite" className="font-mono text-[11px]">
        <span className="font-bold text-foreground">{formatX(active.x)}</span>{" "}
        <span className={active.profitPerDay >= 0 ? "text-nd-green" : "text-nd-red"}>
          {t("whatIf.perDay", { profit: money(active.profitPerDay) })}
        </span>
        <span className="text-muted-foreground">
          {" · "}
          {t("whatIf.load", { pct: Math.round(active.loadFactor * 100) })}
          {" · "}
          {t("whatIf.share", { pct: Math.round(active.share * 100) })}
        </span>
      </p>
      {onPick && pickBestLabel && best.x !== curve.current ? (
        <button
          type="button"
          data-testid="what-if-best"
          onClick={() => onPick(best.x)}
          className="min-h-8 self-start rounded-[3px] bg-sign-yellow px-2 font-sign text-[11px] font-extrabold uppercase tracking-[0.06em] text-sign-black"
        >
          {pickBestLabel(formatX(best.x))} ▶
        </button>
      ) : null}
      <table className="sr-only">
        <caption>{t("whatIf.title")}</caption>
        <tbody>
          {curve.points.map((p) => (
            <tr key={p.x}>
              <th scope="row">{formatX(p.x)}</th>
              <td>{money(p.profitPerDay)}</td>
              <td>{Math.round(p.loadFactor * 100)}%</td>
              <td>{Math.round(p.share * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
