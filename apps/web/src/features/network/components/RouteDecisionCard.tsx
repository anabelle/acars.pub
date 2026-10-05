import type { FixedPoint } from "@acars/core";
import {
  canonicalRouteKey,
  fpScale,
  fpToNumber,
  getMaxRouteDistanceKm,
  TICKS_PER_HOUR,
} from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  DAYS_PER_LEASE_MONTH,
  NEW_ROUTE_WEEKLY_FREQUENCY,
  recommendAircraftForRoute,
} from "@/features/network/utils/routeRecommendation";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatMoney(value: FixedPoint): string {
  return money.format(Math.round(fpToNumber(value)));
}

type RouteDecisionCardProps = {
  originIata: string;
  destinationIata: string;
  distanceKm: number;
};

/**
 * Answers "is a route here worth it?" for the airport panel, using the
 * engine-exact projection. Read-only (the launch action is wired in S23.4).
 */
export function RouteDecisionCard({
  originIata,
  destinationIata,
  distanceKm,
}: RouteDecisionCardProps) {
  const { t } = useTranslation(["game"]);
  const airline = useAirlineStore((s) => s.airline);
  const routes = useAirlineStore((s) => s.routes);
  const pubkey = useAirlineStore((s) => s.pubkey);
  const registry = useAirlineStore((s) => s.globalRouteRegistry);
  // Re-project at most once per game hour; season, prosperity and fuel move slowly.
  const hourTick = useEngineStore((s) => Math.floor(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR);

  const tier = airline?.tier ?? 1;
  const distanceLimitKm = getMaxRouteDistanceKm(tier);

  const recommendation = useMemo(() => {
    if (!airline) return null;
    return recommendAircraftForRoute({
      originIata,
      destinationIata,
      distanceKm,
      tier,
      tick: hourTick,
      brandScore: airline.brandScore ?? 0.5,
      playerPubkey: pubkey ?? "",
      competitorOffers: registry?.get(canonicalRouteKey(originIata, destinationIata)) ?? [],
      networkRoutes: [
        ...routes,
        { originIata, destinationIata, frequencyPerWeek: NEW_ROUTE_WEEKLY_FREQUENCY },
      ],
    });
  }, [airline, originIata, destinationIata, distanceKm, tier, hourTick, pubkey, registry, routes]);

  if (!airline) return null;

  if (!recommendation) {
    return (
      <section
        data-testid="route-decision-card"
        className="rounded-[22px] border border-border/60 bg-background/88 p-4 text-sm text-muted-foreground"
      >
        {t("routeCard.outOfRange", { ns: "game", distance: distanceKm.toLocaleString() })}
      </section>
    );
  }

  const { model, projection, profitAfterLeasePerDay } = recommendation;
  const profitable = profitAfterLeasePerDay > 0;
  const rivals = projection.competitorShares.length;
  const ProfitIcon = profitable ? TrendingUp : TrendingDown;

  return (
    <section
      data-testid="route-decision-card"
      aria-labelledby="route-decision-title"
      className="space-y-3 rounded-[22px] border border-primary/30 bg-primary/5 p-4 sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 id="route-decision-title" className="text-sm font-semibold text-foreground">
          {t("routeCard.title", { ns: "game", origin: originIata, destination: destinationIata })}
        </h4>
        <span className="font-mono text-xs text-muted-foreground">
          {distanceKm.toLocaleString()} km
        </span>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("routeCard.profitLabel", { ns: "game" })}
        </p>
        <p
          data-testid="route-decision-profit"
          className={`mt-1 flex items-center gap-2 font-mono text-2xl font-black ${profitable ? "text-emerald-400" : "text-rose-400"}`}
        >
          <ProfitIcon className="h-5 w-5" aria-hidden="true" />
          {t("routeCard.perDay", { ns: "game", amount: formatMoney(profitAfterLeasePerDay) })}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-border/50 bg-background/70 p-2">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("routeCard.loadFactor", { ns: "game" })}
          </dt>
          <dd className="font-mono text-sm font-semibold">
            {Math.round(projection.loadFactor * 100)}%
          </dd>
        </div>
        <div className="rounded-xl border border-border/50 bg-background/70 p-2">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("routeCard.flightsPerDay", { ns: "game" })}
          </dt>
          <dd className="font-mono text-sm font-semibold">{projection.flightsPerDay.toFixed(1)}</dd>
        </div>
        <div className="rounded-xl border border-border/50 bg-background/70 p-2">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("routeCard.rivals", { ns: "game" })}
          </dt>
          <dd className="font-mono text-sm font-semibold">
            {rivals === 0
              ? t("routeCard.noRivals", { ns: "game" })
              : t("routeCard.share", {
                  ns: "game",
                  share: Math.round(projection.marketShare * 100),
                })}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        {t("routeCard.aircraft", {
          ns: "game",
          model: model.name.startsWith(model.manufacturer)
            ? model.name
            : `${model.manufacturer} ${model.name}`,
          lease: formatMoney(fpScale(model.monthlyLease, 1 / DAYS_PER_LEASE_MONTH)),
        })}
      </p>

      {distanceKm > distanceLimitKm ? (
        <p className="text-xs text-amber-300">
          {t("routeCard.beyondTier", { ns: "game", limit: distanceLimitKm.toLocaleString() })}
        </p>
      ) : null}
      {!profitable ? (
        <p className="text-xs text-rose-300">{t("routeCard.unprofitable", { ns: "game" })}</p>
      ) : null}
      <p className="text-[11px] text-muted-foreground/80">
        {t("routeCard.estimateNote", { ns: "game" })}
      </p>
    </section>
  );
}
