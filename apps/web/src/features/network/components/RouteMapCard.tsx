import { fpToNumber } from "@acars/core";
import type { RouteSelection } from "@acars/map";
import { useAirlineStore } from "@acars/store";
import { Link } from "@tanstack/react-router";
import { Route as RouteIcon, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRoutePerformance } from "@/features/corporate/hooks/useRoutePerformance";
import { MOBILE_BOTTOM_NAV_BOTTOM_CLASS } from "@/shared/components/layout/mobileLayout";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/50 bg-background/60 px-2.5 py-2">
      <dt className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate font-mono text-sm font-bold" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

/**
 * The card a route arc opens on the globe (S56.2): who flies it, how often and
 * how far, and for your own routes how it earns, with doors to the route list
 * (fares and frequency) and to either airport. A bottom sheet on phones.
 */
export function RouteMapCard({
  selection,
  onClose,
}: {
  selection: RouteSelection;
  onClose: () => void;
}) {
  const { t } = useTranslation("game");
  const routes = useAirlineStore((s) => s.routes);
  const timeline = useAirlineStore((s) => s.timeline);
  const routesByOwner = useAirlineStore((s) => s.routesByOwner);
  const competitors = useAirlineStore((s) => s.competitors);
  const performance = useRoutePerformance(timeline, routes);

  const route = useMemo(() => {
    const own = selection.isPlayer
      ? routes.find((r) => r.id === selection.routeId)
      : routesByOwner.get(selection.ownerPubkey)?.find((r) => r.id === selection.routeId);
    return own ?? null;
  }, [selection, routes, routesByOwner]);
  const stats = selection.isPlayer
    ? performance.find((entry) => entry.routeId === selection.routeId)
    : undefined;
  const ownerName = selection.isPlayer
    ? t("routeMapCard.yours")
    : (competitors.get(selection.ownerPubkey)?.name ?? t("routeMapCard.rival"));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const { originIata, destinationIata } = selection;
  return (
    <section
      data-testid="route-card"
      data-owner={selection.isPlayer ? "player" : "rival"}
      aria-labelledby="route-card-title"
      className={`pointer-events-auto absolute inset-x-3 z-30 rounded-[24px] border border-border/80 bg-background/96 p-4 shadow-[0_26px_80px_rgba(0,0,0,0.68)] backdrop-blur-2xl ${MOBILE_BOTTOM_NAV_BOTTOM_CLASS} sm:inset-x-auto sm:right-20 sm:bottom-14 sm:w-96`}
    >
      <div className="flex items-start gap-3">
        <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
            {t("routeMapCard.kicker")}
          </p>
          <h2 id="route-card-title" className="font-mono text-lg font-black text-foreground">
            {originIata} ⇄ {destinationIata}
          </h2>
          <p className="truncate text-xs text-muted-foreground" data-testid="route-card-owner">
            {ownerName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("routeMapCard.close")}
          className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2">
        <Stat
          label={t("routeMapCard.frequency")}
          value={route?.frequencyPerWeek != null ? `${route.frequencyPerWeek}×` : "—"}
          testId="route-card-frequency"
        />
        <Stat
          label={t("routeMapCard.distance")}
          value={route ? `${Math.round(route.distanceKm).toLocaleString()} km` : "—"}
        />
        {selection.isPlayer ? (
          <>
            <Stat
              label={t("routeMapCard.profit")}
              value={stats ? money.format(Math.round(fpToNumber(stats.profitPerHour))) : "—"}
              testId="route-card-profit"
            />
            <Stat
              label={t("routeMapCard.loadFactor")}
              value={stats ? `${Math.round(stats.avgLoadFactor * 100)}%` : "—"}
            />
          </>
        ) : null}
      </dl>
      {selection.isPlayer && !stats ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{t("routeMapCard.noLandings")}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {selection.isPlayer ? (
          <Link
            to="/network"
            search={{ tab: "active" }}
            onClick={onClose}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            {t("routeMapCard.manage")}
          </Link>
        ) : null}
        {[originIata, destinationIata].map((iata) => (
          <Link
            key={iata}
            to="/airport/$iata"
            params={{ iata }}
            onClick={onClose}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border/60 px-3 py-2 font-mono text-xs font-semibold text-foreground hover:bg-accent"
          >
            {t("routeMapCard.openAirport", { iata })}
          </Link>
        ))}
      </div>
    </section>
  );
}
