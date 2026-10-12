import { canonicalRouteKey, fpScale, getMaxRouteDistanceKm, TICKS_PER_HOUR } from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { Loader2, PlaneTakeoff, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  formatMoney,
  modelLabel,
  useConfirmedLaunch,
} from "@/features/network/hooks/useConfirmedLaunch";
import { findAvailableAircraft } from "@/features/network/utils/launchRoute";
import {
  DAYS_PER_LEASE_MONTH,
  NEW_ROUTE_WEEKLY_FREQUENCY,
  recommendAircraftForRoute,
} from "@/features/network/utils/routeRecommendation";

/** A market share as a whole percent, with "<1%" for tiny but real shares. */
function formatShare(share: number): string {
  if (share > 0 && share < 0.01) return "<1%";
  if (share < 1 && share > 0.99) return ">99%";
  return `${Math.round(share * 100)}%`;
}

type RouteDecisionCardProps = {
  originIata: string;
  destinationIata: string;
  distanceKm: number;
};

/**
 * Answers "is a route here worth it?" for the airport panel, using the
 * engine-exact projection, and launches it in one click: open the route,
 * lease the recommended aircraft (or reuse an idle one), assign it. When the
 * route already exists without an aircraft (e.g. an interrupted launch), the
 * same button finishes the setup.
 */
export function RouteDecisionCard({
  originIata,
  destinationIata,
  distanceKm,
}: RouteDecisionCardProps) {
  const { t } = useTranslation(["game"]);
  const airline = useAirlineStore((s) => s.airline);
  const routes = useAirlineStore((s) => s.routes);
  const fleet = useAirlineStore((s) => s.fleet);
  const pubkey = useAirlineStore((s) => s.pubkey);
  const registry = useAirlineStore((s) => s.globalRouteRegistry);
  // Re-project at most once per game hour; season, prosperity and fuel move slowly.
  const hourTick = useEngineStore((s) => Math.floor(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR);

  const { state: launchState, launchWithConfirm } = useConfirmedLaunch();

  const existingRoute = routes.find(
    (route) => route.originIata === originIata && route.destinationIata === destinationIata,
  );
  const routeHasAircraft = existingRoute
    ? fleet.some((aircraft) => aircraft.assignedRouteId === existingRoute.id)
    : false;

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
      frequencyPerWeek: existingRoute?.frequencyPerWeek,
      // The airline's network once this route flies (counted once if it already exists).
      networkRoutes: existingRoute
        ? routes
        : [
            ...routes,
            { originIata, destinationIata, frequencyPerWeek: NEW_ROUTE_WEEKLY_FREQUENCY },
          ],
    });
  }, [
    airline,
    originIata,
    destinationIata,
    distanceKm,
    tier,
    hourTick,
    pubkey,
    registry,
    routes,
    existingRoute,
  ]);

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
  const label = modelLabel(model);
  // launchRoute reuses an unassigned aircraft parked at the origin before leasing one.
  const reusableAircraft = findAvailableAircraft(fleet, { originIata, distanceKm });
  const isRunning = launchState.phase === "running";
  const lastResult = launchState.phase === "done" ? launchState.result : null;

  const handleLaunch = () => launchWithConfirm({ originIata, destinationIata, distanceKm, model });

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
            {t("routeCard.yourShare", { ns: "game" })}
          </dt>
          <dd className="font-mono text-sm font-semibold" data-testid="route-decision-share">
            {formatShare(projection.marketShare)}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground" data-testid="route-decision-market">
        {projection.incumbent
          ? t("routeCard.incumbent", {
              ns: "game",
              flights: Math.round(projection.incumbent.frequencyPerWeek).toLocaleString(),
              share: formatShare(projection.incumbent.share),
            })
          : t("routeCard.uncontested", { ns: "game" })}
        {rivals > 0 ? ` ${t("routeCard.otherAirlines", { ns: "game", count: rivals })}` : ""}
      </p>

      <p className="text-xs text-muted-foreground">
        {t("routeCard.aircraft", {
          ns: "game",
          model: label,
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
      {lastResult && lastResult.status !== "complete" ? (
        <p role="alert" className="text-xs text-rose-300">
          {t(`routeCard.failedStep.${lastResult.failedStep ?? "openRoute"}`, { ns: "game" })}{" "}
          {lastResult.error}
        </p>
      ) : null}

      {routeHasAircraft ? null : (
        <button
          type="button"
          onClick={handleLaunch}
          disabled={isRunning}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 touch-manipulation"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <PlaneTakeoff className="h-4 w-4" aria-hidden="true" />
          )}
          {isRunning
            ? t("routeCard.launching", { ns: "game" })
            : existingRoute
              ? t("routeCard.finishSetup", { ns: "game" })
              : reusableAircraft
                ? t("routeCard.launchReuse", { ns: "game", aircraft: reusableAircraft.name })
                : t("routeCard.launch", { ns: "game", model: label })}
        </button>
      )}

      <p className="text-[11px] text-muted-foreground/80">
        {t("routeCard.estimateNote", { ns: "game" })}
      </p>
    </section>
  );
}
