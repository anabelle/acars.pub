import type { FixedPoint } from "@acars/core";
import {
  canonicalRouteKey,
  fp,
  fpScale,
  fpToNumber,
  getMaxRouteDistanceKm,
  ROUTE_SLOT_FEE,
  TICKS_PER_HOUR,
} from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { Loader2, PlaneTakeoff, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useLaunchRoute } from "@/features/network/hooks/useLaunchRoute";
import { findAvailableAircraft } from "@/features/network/utils/launchRoute";
import {
  DAYS_PER_LEASE_MONTH,
  NEW_ROUTE_WEEKLY_FREQUENCY,
  recommendAircraftForRoute,
} from "@/features/network/utils/routeRecommendation";
import { useConfirm } from "@/shared/lib/useConfirm";

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

/** Lease deposit charged up front (see fleetSlice.purchaseAircraft). */
const LEASE_DEPOSIT_SHARE = 0.1;

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

  const confirm = useConfirm();
  const { state: launchState, launch } = useLaunchRoute();

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
      frequencyPerWeek: existingRoute?.frequencyPerWeek ?? NEW_ROUTE_WEEKLY_FREQUENCY,
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
  const modelLabel = model.name.startsWith(model.manufacturer)
    ? model.name
    : `${model.manufacturer} ${model.name}`;
  // launchRoute reuses an unassigned aircraft parked at the origin before leasing one.
  const reusableAircraft = findAvailableAircraft(fleet, { originIata, distanceKm });
  const isRunning = launchState.phase === "running";
  const lastResult = launchState.phase === "done" ? launchState.result : null;

  const handleLaunch = async () => {
    const deliveryMinutes = Math.max(
      1,
      Math.round((model.deliveryTimeTicks / TICKS_PER_HOUR) * 60),
    );
    const approved = await confirm({
      title: existingRoute
        ? t("routeCard.finishConfirmTitle", {
            ns: "game",
            origin: originIata,
            destination: destinationIata,
          })
        : t("routeCard.launchConfirmTitle", {
            ns: "game",
            origin: originIata,
            destination: destinationIata,
          }),
      description: reusableAircraft
        ? t("routeCard.reuseConfirmDescription", {
            ns: "game",
            slotFee: formatMoney(existingRoute ? fp(0) : ROUTE_SLOT_FEE),
            aircraft: reusableAircraft.name,
          })
        : t("routeCard.launchConfirmDescription", {
            ns: "game",
            slotFee: formatMoney(existingRoute ? fp(0) : ROUTE_SLOT_FEE),
            model: modelLabel,
            deposit: formatMoney(fpScale(model.price, LEASE_DEPOSIT_SHARE)),
            lease: formatMoney(fpScale(model.monthlyLease, 1 / DAYS_PER_LEASE_MONTH)),
            minutes: deliveryMinutes,
          }),
      confirmLabel: t("routeCard.launchConfirmLabel", { ns: "game" }),
    });
    if (!approved) return;

    const result = await launch({ originIata, destinationIata, distanceKm, model });
    if (result.status === "complete") {
      toast.success(
        t("routeCard.launched", { ns: "game", origin: originIata, destination: destinationIata }),
        { description: t("routeCard.launchedDetail", { ns: "game", minutes: deliveryMinutes }) },
      );
    } else {
      toast.error(t("routeCard.launchFailed", { ns: "game" }), { description: result.error });
    }
  };

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
          model: modelLabel,
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
              : t("routeCard.launch", {
                  ns: "game",
                  model: reusableAircraft ? reusableAircraft.name : modelLabel,
                })}
        </button>
      )}

      <p className="text-[11px] text-muted-foreground/80">
        {t("routeCard.estimateNote", { ns: "game" })}
      </p>
    </section>
  );
}
