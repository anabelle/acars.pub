import type { FixedPoint } from "@acars/core";
import { fpToNumber, TICKS_PER_HOUR } from "@acars/core";
import { Plane, TrendingDown, TrendingUp, Users, X } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { useAwayReport } from "@/features/airline/hooks/useAwayReport";
import type { RouteResult, TimelineSummary } from "@/features/airline/utils/summarizeTimeline";
import { ModalPortal } from "@/shared/components/ModalPortal";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const formatMoney = (value: FixedPoint) => money.format(Math.round(fpToNumber(value)));
const signedMoney = (value: FixedPoint) =>
  `${fpToNumber(value) > 0 ? "+" : ""}${formatMoney(value)}`;

/** Absence length as an i18n key + count: hours up to two days, then days. */
function durationParts(ticks: number): {
  key: "awayReport.hours" | "awayReport.days";
  count: number;
} {
  const hours = Math.floor(ticks / TICKS_PER_HOUR);
  return hours < 48
    ? { key: "awayReport.hours", count: hours }
    : { key: "awayReport.days", count: Math.floor(hours / 24) };
}

function RouteLine({ label, route }: { label: string; route: RouteResult }) {
  const positive = fpToNumber(route.profit) >= 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/70 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="font-mono text-sm font-semibold">
          {route.originIata} ⇄ {route.destinationIata}
        </p>
      </div>
      <span
        className={`font-mono text-sm font-bold ${positive ? "text-emerald-400" : "text-rose-400"}`}
      >
        {signedMoney(route.profit)}
      </span>
    </div>
  );
}

export function AwayReportDialog({
  summary,
  onClose,
}: {
  summary: TimelineSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation(["game"]);
  const titleId = React.useId();
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const profitable = fpToNumber(summary.profit) >= 0;
  const ProfitIcon = profitable ? TrendingUp : TrendingDown;
  const quiet = summary.flights === 0;
  const duration = durationParts(summary.toTick - summary.coveredFromTick);

  React.useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[900] flex items-end justify-center sm:items-center">
        <button
          type="button"
          aria-label={t("awayReport.close", { ns: "game" })}
          tabIndex={-1}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid="away-report"
          className="relative z-10 max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl border border-border bg-background/95 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:rounded-3xl sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("awayReport.eyebrow", {
                  ns: "game",
                  duration: t(duration.key, { ns: "game", count: duration.count }),
                })}
              </p>
              <h2 id={titleId} className="mt-1 text-lg font-bold text-foreground">
                {quiet
                  ? t("awayReport.quietTitle", { ns: "game" })
                  : t("awayReport.title", { ns: "game" })}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t("awayReport.close", { ns: "game" })}
              className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {quiet ? (
            <p className="text-sm text-muted-foreground">
              {t("awayReport.quietBody", { ns: "game" })}
            </p>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("awayReport.profit", { ns: "game" })}
                </p>
                <p
                  data-testid="away-report-profit"
                  className={`mt-1 flex items-center gap-2 font-mono text-3xl font-black ${profitable ? "text-emerald-400" : "text-rose-400"}`}
                >
                  <ProfitIcon className="h-6 w-6" aria-hidden="true" />
                  {signedMoney(summary.profit)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("awayReport.revenueCosts", {
                    ns: "game",
                    revenue: formatMoney(summary.revenue),
                    costs: formatMoney(summary.costs),
                  })}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/50 bg-background/70 p-3">
                  <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Plane className="h-3 w-3" aria-hidden="true" />
                    {t("awayReport.flights", { ns: "game" })}
                  </dt>
                  <dd className="font-mono text-lg font-semibold">
                    {summary.flights.toLocaleString()}
                  </dd>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/70 p-3">
                  <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {t("awayReport.passengers", { ns: "game" })}
                  </dt>
                  <dd className="font-mono text-lg font-semibold">
                    {summary.passengers.toLocaleString()}
                  </dd>
                </div>
              </dl>

              {summary.bestRoute ? (
                <div className="space-y-2">
                  <RouteLine
                    label={t("awayReport.bestRoute", { ns: "game" })}
                    route={summary.bestRoute}
                  />
                  {summary.worstRoute ? (
                    <RouteLine
                      label={t("awayReport.worstRoute", { ns: "game" })}
                      route={summary.worstRoute}
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          <ul className="space-y-1.5 text-sm">
            {summary.newTier ? (
              <li className="text-emerald-300">
                {t("awayReport.promoted", { ns: "game", tier: summary.newTier })}
              </li>
            ) : null}
            {summary.deliveries > 0 ? (
              <li className="text-muted-foreground">
                {t("awayReport.deliveries", { ns: "game", count: summary.deliveries })}
              </li>
            ) : null}
            {summary.groundedAircraft.length > 0 ? (
              <li className="text-amber-300">
                {t("awayReport.grounded", {
                  ns: "game",
                  count: summary.groundedAircraft.length,
                  names: summary.groundedAircraft.map((aircraft) => aircraft.name).join(", "),
                })}
              </li>
            ) : null}
            {summary.priceWarRoutes.length > 0 ? (
              <li className="text-amber-300">
                {t("awayReport.priceWar", {
                  ns: "game",
                  routes: summary.priceWarRoutes.join(", "),
                })}
              </li>
            ) : null}
            {summary.bankrupt ? (
              <li className="font-semibold text-rose-300">
                {t("awayReport.bankrupt", { ns: "game" })}
              </li>
            ) : null}
          </ul>

          {!summary.complete ? (
            <p className="text-[11px] text-muted-foreground/80">
              {t("awayReport.partial", { ns: "game" })}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            {t("awayReport.continue", { ns: "game" })}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}

/** Mounted once at the app root; shows the report after an absence of an hour or more. */
export function AwayReport() {
  const { summary, dismiss } = useAwayReport();
  if (!summary) return null;
  return <AwayReportDialog summary={summary} onClose={dismiss} />;
}
