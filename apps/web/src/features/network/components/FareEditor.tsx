import {
  FARE_CAP_MULTIPLIER,
  computeRouteFrequency,
  type FixedPoint,
  fp,
  fpAdd,
  fpFormat,
  fpScale,
  fpToNumber,
  getSuggestedFares,
  PRICE_ELASTICITY_BUSINESS,
  PRICE_ELASTICITY_ECONOMY,
  PRICE_ELASTICITY_FIRST,
} from "@acars/core";
import { useActiveAirline, useAirlineStore, useEngineStore } from "@acars/store";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getRouteDemandSnapshotCached } from "@/features/network/hooks/useRouteDemand";
import {
  calculateElasticityDisplay,
  formatSignedPercent,
  getElasticityTone,
  parseFareInput,
  toneDotClass,
  toneTextClass,
} from "@/features/network/utils/fareTones";
import { ModalPortal } from "@/shared/components/ModalPortal";
import { navigateToAirport } from "@/shared/lib/permalinkNavigation";

export interface FareEditorTarget {
  routeId: string;
  originIata: string;
  destinationIata: string;
  distanceKm: number;
}

const faresOf = (
  route: { fareEconomy: FixedPoint; fareBusiness: FixedPoint; fareFirst: FixedPoint } | undefined,
) => ({
  e: route ? fpToNumber(route.fareEconomy).toString() : "",
  b: route ? fpToNumber(route.fareBusiness).toString() : "",
  f: route ? fpToNumber(route.fareFirst).toString() : "",
});

/** Modal for repricing one route; seeds its inputs from the route's current fares. */
export function FareEditor({
  target: fareEditor,
  onClose,
}: {
  target: FareEditorTarget;
  onClose: () => void;
}) {
  const { t } = useTranslation(["common", "game"]);
  const { routes, fleet } = useActiveAirline();
  const tick = useEngineStore((s) => s.tick);
  const updateRouteFares = useAirlineStore((s) => s.updateRouteFares);
  const [fareInputs, setFareInputs] = useState<{ e: string; b: string; f: string }>(() =>
    faresOf(routes.find((route) => route.id === fareEditor.routeId)),
  );
  const [fareError, setFareError] = useState<string | null>(null);
  const [isSavingFares, setIsSavingFares] = useState(false);

  const fareData = useMemo(() => {
    const suggestedFares = getSuggestedFares(fareEditor.distanceKm);
    const activeFareRoute = routes.find((route) => route.id === fareEditor.routeId) ?? null;
    const fareDemandSnapshot = activeFareRoute
      ? getRouteDemandSnapshotCached(activeFareRoute, tick, fleet, routes)
      : null;
    const fareInputValues = {
      economy: parseFareInput(fareInputs.e),
      business: parseFareInput(fareInputs.b),
      first: parseFareInput(fareInputs.f),
    };
    const resolvedFareInputs = {
      economy:
        fareInputValues.economy ?? (activeFareRoute ? fpToNumber(activeFareRoute.fareEconomy) : 0),
      business:
        fareInputValues.business ??
        (activeFareRoute ? fpToNumber(activeFareRoute.fareBusiness) : 0),
      first: fareInputValues.first ?? (activeFareRoute ? fpToNumber(activeFareRoute.fareFirst) : 0),
    };
    const fareElasticity = {
      economy: calculateElasticityDisplay(
        fp(resolvedFareInputs.economy),
        suggestedFares.economy,
        PRICE_ELASTICITY_ECONOMY,
      ),
      business: calculateElasticityDisplay(
        fp(resolvedFareInputs.business),
        suggestedFares.business,
        PRICE_ELASTICITY_BUSINESS,
      ),
      first: calculateElasticityDisplay(
        fp(resolvedFareInputs.first),
        suggestedFares.first,
        PRICE_ELASTICITY_FIRST,
      ),
    };

    let fareProjection: {
      currentRevenue: FixedPoint;
      suggestedRevenue: FixedPoint;
      currentPassengers: number;
      suggestedPassengers: number;
      deltaRevenue: number;
      deltaPassengers: number;
    } | null = null;

    if (suggestedFares && fareDemandSnapshot && activeFareRoute) {
      const assignedFleet = activeFareRoute.assignedAircraftIds
        .map((id) => fleet.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (assignedFleet.length > 0) {
        const weeklyDemand = fareDemandSnapshot.addressableDemand;
        const frequency = computeRouteFrequency(
          activeFareRoute.distanceKm,
          activeFareRoute.assignedAircraftIds.length,
        );
        if (frequency > 0) {
          const pressureMultiplier = fareDemandSnapshot.pressureMultiplier;
          const currentEconomy = resolvedFareInputs.economy;
          const currentBusiness = resolvedFareInputs.business;
          const currentFirst = resolvedFareInputs.first;

          const currentElasticity = {
            economy: fareElasticity.economy.multiplier,
            business: fareElasticity.business.multiplier,
            first: fareElasticity.first.multiplier,
          };

          const currentPassengers = {
            economy: Math.floor(
              (weeklyDemand.economy / frequency) * pressureMultiplier * currentElasticity.economy,
            ),
            business: Math.floor(
              (weeklyDemand.business / frequency) * pressureMultiplier * currentElasticity.business,
            ),
            first: Math.floor(
              (weeklyDemand.first / frequency) * pressureMultiplier * currentElasticity.first,
            ),
          };

          const suggestedPassengers = {
            economy: Math.floor((weeklyDemand.economy / frequency) * pressureMultiplier),
            business: Math.floor((weeklyDemand.business / frequency) * pressureMultiplier),
            first: Math.floor((weeklyDemand.first / frequency) * pressureMultiplier),
          };

          const currentRevenue = fpAdd(
            fpAdd(
              fpScale(fp(currentEconomy), currentPassengers.economy),
              fpScale(fp(currentBusiness), currentPassengers.business),
            ),
            fpScale(fp(currentFirst), currentPassengers.first),
          );

          const suggestedRevenue = fpAdd(
            fpAdd(
              fpScale(suggestedFares.economy, suggestedPassengers.economy),
              fpScale(suggestedFares.business, suggestedPassengers.business),
            ),
            fpScale(suggestedFares.first, suggestedPassengers.first),
          );

          const currentTotalPassengers =
            currentPassengers.economy + currentPassengers.business + currentPassengers.first;
          const suggestedTotalPassengers =
            suggestedPassengers.economy + suggestedPassengers.business + suggestedPassengers.first;

          fareProjection = {
            currentRevenue,
            suggestedRevenue,
            currentPassengers: currentTotalPassengers,
            suggestedPassengers: suggestedTotalPassengers,
            deltaRevenue: fpToNumber(currentRevenue) - fpToNumber(suggestedRevenue),
            deltaPassengers: currentTotalPassengers - suggestedTotalPassengers,
          };
        }
      }
    }

    return {
      suggestedFares,
      activeFareRoute,
      fareDemandSnapshot,
      fareInputValues,
      resolvedFareInputs,
      fareElasticity,
      fareProjection,
    };
  }, [fareEditor, fareInputs, routes, tick, fleet]);

  const { suggestedFares, fareElasticity, fareProjection } = fareData;

  const handleSaveFares = async () => {
    const eVal = parseInt(fareInputs.e.replace(/[^0-9]/g, ""), 10);
    const bVal = parseInt(fareInputs.b.replace(/[^0-9]/g, ""), 10);
    const fVal = parseInt(fareInputs.f.replace(/[^0-9]/g, ""), 10);

    if ([eVal, bVal, fVal].every((val) => Number.isNaN(val))) {
      setFareError(t("routeManager.fares.enterAtLeastOne", { ns: "game" }));
      return;
    }

    setFareError(null);
    setIsSavingFares(true);
    try {
      await updateRouteFares(fareEditor.routeId, {
        economy: Number.isNaN(eVal) ? undefined : fp(eVal),
        business: Number.isNaN(bVal) ? undefined : fp(bVal),
        first: Number.isNaN(fVal) ? undefined : fp(fVal),
      });
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("routeManager.unknownError", { ns: "game" });
      toast.error(t("routeManager.fareUpdateFailed", { ns: "game" }), {
        description: message,
      });
    } finally {
      setIsSavingFares(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => !isSavingFares && onClose()}
          aria-label="Close fare editor"
        />
        <div className="relative z-10 flex w-full max-h-[100dvh] flex-col overflow-hidden rounded-t-[24px] border border-border bg-background/95 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:max-h-[85vh] sm:max-w-xl sm:rounded-2xl">
          <div className="shrink-0 flex items-start justify-between border-b border-border/50 px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Route Pricing
              </p>
              <h3 className="flex items-center gap-1.5 text-lg font-bold text-foreground">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigateToAirport(fareEditor.originIata);
                  }}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  {fareEditor.originIata}
                </button>
                <span className="text-muted-foreground">→</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigateToAirport(fareEditor.destinationIata);
                  }}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  {fareEditor.destinationIata}
                </button>
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Distance: {Math.round(fareEditor.distanceKm).toLocaleString()} km
              </p>
            </div>
            <button
              type="button"
              onClick={() => !isSavingFares && onClose()}
              className="rounded-full bg-background/60 p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close fare editor"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-10 space-y-4 sm:px-6 sm:py-5 sm:pb-12 sm:space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-background/60 p-4">
                <label
                  htmlFor="fare-economy"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  Economy
                </label>
                <input
                  id="fare-economy"
                  type="number"
                  min="0"
                  step="1"
                  max={
                    suggestedFares
                      ? Math.round(fpToNumber(suggestedFares.economy) * FARE_CAP_MULTIPLIER)
                      : undefined
                  }
                  value={fareInputs.e}
                  onChange={(e) => setFareInputs({ ...fareInputs, e: e.target.value })}
                  className="mt-2 h-10 w-full rounded-lg bg-background border border-border/50 px-3 text-sm font-medium outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
                {suggestedFares ? (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Suggested: {fpToNumber(suggestedFares.economy)} · max{" "}
                    {Math.round(fpToNumber(suggestedFares.economy) * FARE_CAP_MULTIPLIER)}
                  </p>
                ) : null}
                {suggestedFares && fareElasticity ? (
                  <div className="mt-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="uppercase text-muted-foreground">Demand Impact</span>
                      <span
                        className={`font-mono ${toneTextClass[getElasticityTone(fareElasticity.economy.multiplier)]}`}
                      >
                        {fareElasticity.economy.multiplier.toFixed(2)}x
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-background/70 overflow-hidden relative">
                      <div
                        className={`h-full transition-all duration-500 ${toneDotClass[getElasticityTone(fareElasticity.economy.multiplier)]}`}
                        style={{
                          width: `${Math.min(100, (fareElasticity.economy.multiplier / 1.5) * 100)}%`,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 left-[66.7%] w-px bg-white/30"
                        aria-hidden
                      />
                      {fareElasticity.economy.multiplier > 1 && (
                        <div
                          className="absolute inset-y-0 left-[66.7%] bg-sky-500/70"
                          style={{
                            width: `${Math.min(33.3, ((fareElasticity.economy.multiplier - 1) / 0.5) * 33.3)}%`,
                          }}
                        />
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Fare is {formatSignedPercent(fareElasticity.economy.deltaPercent)} vs market
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-border/50 bg-background/60 p-4">
                <label
                  htmlFor="fare-business"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  Business
                </label>
                <input
                  id="fare-business"
                  type="number"
                  min="0"
                  step="1"
                  max={
                    suggestedFares
                      ? Math.round(fpToNumber(suggestedFares.business) * FARE_CAP_MULTIPLIER)
                      : undefined
                  }
                  value={fareInputs.b}
                  onChange={(e) => setFareInputs({ ...fareInputs, b: e.target.value })}
                  className="mt-2 h-10 w-full rounded-lg bg-background border border-border/50 px-3 text-sm font-medium outline-none focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 text-blue-400"
                />
                {suggestedFares ? (
                  <p className="mt-2 text-[10px] text-blue-400/70">
                    Suggested: {fpToNumber(suggestedFares.business)} · max{" "}
                    {Math.round(fpToNumber(suggestedFares.business) * FARE_CAP_MULTIPLIER)}
                  </p>
                ) : null}
                {suggestedFares && fareElasticity ? (
                  <div className="mt-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="uppercase text-muted-foreground">Demand Impact</span>
                      <span
                        className={`font-mono ${toneTextClass[getElasticityTone(fareElasticity.business.multiplier)]}`}
                      >
                        {fareElasticity.business.multiplier.toFixed(2)}x
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-background/70 overflow-hidden relative">
                      <div
                        className={`h-full transition-all duration-500 ${toneDotClass[getElasticityTone(fareElasticity.business.multiplier)]}`}
                        style={{
                          width: `${Math.min(100, (fareElasticity.business.multiplier / 1.5) * 100)}%`,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 left-[66.7%] w-px bg-white/30"
                        aria-hidden
                      />
                      {fareElasticity.business.multiplier > 1 && (
                        <div
                          className="absolute inset-y-0 left-[66.7%] bg-sky-500/70"
                          style={{
                            width: `${Math.min(33.3, ((fareElasticity.business.multiplier - 1) / 0.5) * 33.3)}%`,
                          }}
                        />
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Fare is {formatSignedPercent(fareElasticity.business.deltaPercent)} vs market
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-border/50 bg-background/60 p-4">
                <label
                  htmlFor="fare-first"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  First
                </label>
                <input
                  id="fare-first"
                  type="number"
                  min="0"
                  step="1"
                  max={
                    suggestedFares
                      ? Math.round(fpToNumber(suggestedFares.first) * FARE_CAP_MULTIPLIER)
                      : undefined
                  }
                  value={fareInputs.f}
                  onChange={(e) => setFareInputs({ ...fareInputs, f: e.target.value })}
                  className="mt-2 h-10 w-full rounded-lg bg-background border border-border/50 px-3 text-sm font-medium outline-none focus:border-yellow-500/60 focus:ring-2 focus:ring-yellow-500/20 text-yellow-500"
                />
                {suggestedFares ? (
                  <p className="mt-2 text-[10px] text-yellow-500/70">
                    Suggested: {fpToNumber(suggestedFares.first)} · max{" "}
                    {Math.round(fpToNumber(suggestedFares.first) * FARE_CAP_MULTIPLIER)}
                  </p>
                ) : null}
                {suggestedFares && fareElasticity ? (
                  <div className="mt-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="uppercase text-muted-foreground">Demand Impact</span>
                      <span
                        className={`font-mono ${toneTextClass[getElasticityTone(fareElasticity.first.multiplier)]}`}
                      >
                        {fareElasticity.first.multiplier.toFixed(2)}x
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-background/70 overflow-hidden relative">
                      <div
                        className={`h-full transition-all duration-500 ${toneDotClass[getElasticityTone(fareElasticity.first.multiplier)]}`}
                        style={{
                          width: `${Math.min(100, (fareElasticity.first.multiplier / 1.5) * 100)}%`,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 left-[66.7%] w-px bg-white/30"
                        aria-hidden
                      />
                      {fareElasticity.first.multiplier > 1 && (
                        <div
                          className="absolute inset-y-0 left-[66.7%] bg-sky-500/70"
                          style={{
                            width: `${Math.min(33.3, ((fareElasticity.first.multiplier - 1) / 0.5) * 33.3)}%`,
                          }}
                        />
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Fare is {formatSignedPercent(fareElasticity.first.deltaPercent)} vs market
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            {fareProjection ? (
              <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground">
                  Revenue Projection
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">At current fares</span>
                    <span className="font-bold text-foreground">
                      {fpFormat(fareProjection.currentRevenue, 0)} / flight
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">At suggested fares</span>
                    <span className="font-bold text-muted-foreground">
                      {fpFormat(fareProjection.suggestedRevenue, 0)} / flight
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Delta</span>
                    <span
                      className={`font-bold ${fareProjection.deltaRevenue >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                    >
                      {fareProjection.deltaRevenue >= 0 ? "+" : "-"}
                      {Math.abs(fareProjection.deltaRevenue).toLocaleString()} revenue{" "}
                      {fareProjection.deltaPassengers !== 0 && (
                        <span className="text-muted-foreground">
                          ({fareProjection.deltaPassengers > 0 ? "+" : "-"}
                          {Math.abs(fareProjection.deltaPassengers)} pax)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-[10px] text-muted-foreground">
                Assign aircraft to see revenue projection.
              </div>
            )}
            {fareError ? <p className="text-xs font-semibold text-red-400">{fareError}</p> : null}
            <button
              type="button"
              onClick={() => {
                if (!suggestedFares) return;
                setFareInputs({
                  e: fpToNumber(suggestedFares.economy).toString(),
                  b: fpToNumber(suggestedFares.business).toString(),
                  f: fpToNumber(suggestedFares.first).toString(),
                });
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
            >
              Use suggested fares
            </button>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border/50 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
            <button
              type="button"
              onClick={() => onClose()}
              disabled={isSavingFares}
              className="rounded-lg border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
            >
              {t("actions.cancel", { ns: "common" })}
            </button>
            <button
              type="button"
              onClick={handleSaveFares}
              disabled={isSavingFares}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {isSavingFares
                ? t("routeManager.saving", { ns: "game" })
                : t("routeManager.saveFares", { ns: "game" })}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
