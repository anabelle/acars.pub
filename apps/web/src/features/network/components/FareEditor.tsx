import {
  FARE_CAP_MULTIPLIER,
  canonicalRouteKey,
  type FixedPoint,
  fp,
  fpFormat,
  fpToNumber,
  getSuggestedFares,
  PRICE_ELASTICITY_BUSINESS,
  PRICE_ELASTICITY_ECONOMY,
  PRICE_ELASTICITY_FIRST,
  TICKS_PER_HOUR,
} from "@acars/core";
import { getAircraftById } from "@acars/data";
import {
  projectRouteEconomics,
  type RouteProjection,
  useActiveAirline,
  useAirlineStore,
  useEngineStore,
} from "@acars/store";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  calculateElasticityDisplay,
  formatSignedPercent,
  getElasticityTone,
  parseFareInput,
  toneDotClass,
  toneTextClass,
} from "@/features/network/utils/fareTones";
import {
  FARE_PRESETS,
  type FarePresetId,
  fareProjectionBase,
  matchingPreset,
  presetFares,
} from "@/features/network/utils/fareProjection";
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
  const airline = useAirlineStore((s) => s.airline);
  const pubkey = useAirlineStore((s) => s.pubkey);
  const registry = useAirlineStore((s) => s.globalRouteRegistry);
  // Re-project at most once per game hour; season, prosperity and fuel move slowly.
  const hourTick = useEngineStore((s) => Math.floor(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR);
  const updateRouteFares = useAirlineStore((s) => s.updateRouteFares);
  const [fareInputs, setFareInputs] = useState<{ e: string; b: string; f: string }>(() =>
    faresOf(routes.find((route) => route.id === fareEditor.routeId)),
  );
  const [fareError, setFareError] = useState<string | null>(null);
  const [isSavingFares, setIsSavingFares] = useState(false);

  const fareData = useMemo(() => {
    const suggestedFares = getSuggestedFares(fareEditor.distanceKm);
    const activeFareRoute = routes.find((route) => route.id === fareEditor.routeId) ?? null;
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

    return {
      suggestedFares,
      activeFareRoute,
      fareInputValues,
      resolvedFareInputs,
      fareElasticity,
    };
  }, [fareEditor, fareInputs, routes]);

  const { suggestedFares, fareElasticity, activeFareRoute, resolvedFareInputs } = fareData;

  // Outcome-first pricing: forecast the route with the engine's own functions
  // at the fares being typed, next to the fares it flies with today. O(1).
  const projectionBase = useMemo(() => {
    if (!activeFareRoute || !airline) return null;
    return fareProjectionBase({
      route: activeFareRoute,
      fleet,
      getModel: getAircraftById,
      tick: hourTick,
      tier: airline.tier ?? 1,
      brandScore: airline.brandScore ?? 0.5,
      playerPubkey: pubkey ?? "",
      competitorOffers:
        registry?.get(
          canonicalRouteKey(activeFareRoute.originIata, activeFareRoute.destinationIata),
        ) ?? [],
      networkRoutes: routes,
    });
  }, [activeFareRoute, airline, fleet, hourTick, pubkey, registry, routes]);

  const savedOutcome = useMemo(
    () =>
      projectionBase && activeFareRoute
        ? projectRouteEconomics({
            ...projectionBase,
            fares: {
              economy: activeFareRoute.fareEconomy,
              business: activeFareRoute.fareBusiness,
              first: activeFareRoute.fareFirst,
            },
          })
        : null,
    [projectionBase, activeFareRoute],
  );
  const typedOutcome = useMemo(
    () =>
      projectionBase
        ? projectRouteEconomics({
            ...projectionBase,
            fares: {
              economy: fp(resolvedFareInputs.economy),
              business: fp(resolvedFareInputs.business),
              first: fp(resolvedFareInputs.first),
            },
          })
        : null,
    [projectionBase, resolvedFareInputs],
  );
  const activePreset = matchingPreset(fareEditor.distanceKm, resolvedFareInputs);
  const applyPreset = (preset: FarePresetId) => {
    const fares = presetFares(fareEditor.distanceKm, preset);
    setFareInputs({
      e: fares.economy.toString(),
      b: fares.business.toString(),
      f: fares.first.toString(),
    });
  };

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
          aria-label={t("routeManager.fareEditor.closeAria", { ns: "game" })}
        />
        <div className="relative z-10 flex w-full max-h-[100dvh] flex-col overflow-hidden rounded-t-[24px] border border-border bg-background/95 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:max-h-[85vh] sm:max-w-xl sm:rounded-2xl">
          <div className="shrink-0 flex items-start justify-between border-b border-border/50 px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                {t("routeManager.fareEditor.title", { ns: "game" })}
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
                {t("routeManager.fareEditor.distance", {
                  ns: "game",
                  km: Math.round(fareEditor.distanceKm).toLocaleString(),
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => !isSavingFares && onClose()}
              className="rounded-full bg-background/60 p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t("routeManager.fareEditor.closeAria", { ns: "game" })}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-10 space-y-4 sm:px-6 sm:py-5 sm:pb-12 sm:space-y-5">
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label={t("routeManager.fareEditor.presets", { ns: "game" })}
            >
              {(Object.keys(FARE_PRESETS) as FarePresetId[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={activePreset === preset}
                  onClick={() => applyPreset(preset)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activePreset === preset
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border/50 bg-background/60 text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t(`routeManager.fareEditor.preset.${preset}`, { ns: "game" })}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-background/60 p-4">
                <label
                  htmlFor="fare-economy"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  {t("routeManager.fareEditor.class.economy", { ns: "game" })}
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
                    {t("routeManager.fareEditor.suggestedAndMax", {
                      ns: "game",
                      suggested: fpToNumber(suggestedFares.economy),
                      max: Math.round(fpToNumber(suggestedFares.economy) * FARE_CAP_MULTIPLIER),
                    })}
                  </p>
                ) : null}
                {suggestedFares && fareElasticity ? (
                  <div className="mt-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="uppercase text-muted-foreground">
                        {t("routeManager.fareEditor.demandImpact", { ns: "game" })}
                      </span>
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
                      {t("routeManager.fareEditor.vsMarket", {
                        ns: "game",
                        delta: formatSignedPercent(fareElasticity.economy.deltaPercent),
                      })}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-border/50 bg-background/60 p-4">
                <label
                  htmlFor="fare-business"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  {t("routeManager.fareEditor.class.business", { ns: "game" })}
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
                    {t("routeManager.fareEditor.suggestedAndMax", {
                      ns: "game",
                      suggested: fpToNumber(suggestedFares.business),
                      max: Math.round(fpToNumber(suggestedFares.business) * FARE_CAP_MULTIPLIER),
                    })}
                  </p>
                ) : null}
                {suggestedFares && fareElasticity ? (
                  <div className="mt-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="uppercase text-muted-foreground">
                        {t("routeManager.fareEditor.demandImpact", { ns: "game" })}
                      </span>
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
                      {t("routeManager.fareEditor.vsMarket", {
                        ns: "game",
                        delta: formatSignedPercent(fareElasticity.business.deltaPercent),
                      })}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-border/50 bg-background/60 p-4">
                <label
                  htmlFor="fare-first"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  {t("routeManager.fareEditor.class.first", { ns: "game" })}
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
                    {t("routeManager.fareEditor.suggestedAndMax", {
                      ns: "game",
                      suggested: fpToNumber(suggestedFares.first),
                      max: Math.round(fpToNumber(suggestedFares.first) * FARE_CAP_MULTIPLIER),
                    })}
                  </p>
                ) : null}
                {suggestedFares && fareElasticity ? (
                  <div className="mt-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="uppercase text-muted-foreground">
                        {t("routeManager.fareEditor.demandImpact", { ns: "game" })}
                      </span>
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
                      {t("routeManager.fareEditor.vsMarket", {
                        ns: "game",
                        delta: formatSignedPercent(fareElasticity.first.deltaPercent),
                      })}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            {typedOutcome ? (
              <FareOutcome typed={typedOutcome} saved={savedOutcome} />
            ) : (
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                {t("routeManager.fareEditor.assignToProject", { ns: "game" })}
              </div>
            )}
            {fareError ? <p className="text-xs font-semibold text-red-400">{fareError}</p> : null}
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

const signed = (value: number, format: (v: number) => string) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${format(Math.abs(value))}`;

/** What the typed fares do to the route, next to what it earns today. */
function FareOutcome({ typed, saved }: { typed: RouteProjection; saved: RouteProjection | null }) {
  const { t } = useTranslation(["game"]);
  const loadDelta = saved ? Math.round((typed.loadFactor - saved.loadFactor) * 100) : 0;
  const profitDelta = saved
    ? Math.round(fpToNumber(typed.profitPerDay) - fpToNumber(saved.profitPerDay))
    : 0;
  // Shares of a big market are small: keep one decimal below 10%.
  const sharePrecision = Math.max(typed.marketShare, saved?.marketShare ?? 0) < 0.1 ? 10 : 1;
  const shareDelta = saved
    ? Math.round((typed.marketShare - saved.marketShare) * 100 * sharePrecision) / sharePrecision
    : 0;
  const points = (v: number) => t("routeManager.fareEditor.points", { count: v });
  const rows = [
    {
      key: "load",
      label: t("routeManager.fareEditor.seatsFilled"),
      value: `${Math.round(typed.loadFactor * 100)}%`,
      delta: loadDelta,
      deltaText: signed(loadDelta, points),
      tone: "text-foreground",
    },
    {
      key: "profit",
      label: t("routeManager.fareEditor.profitPerDay"),
      value: fpFormat(typed.profitPerDay, 0),
      delta: profitDelta,
      deltaText: signed(profitDelta, (v) => fpFormat(fp(v), 0)),
      tone: fpToNumber(typed.profitPerDay) < 0 ? "text-rose-400" : "text-foreground",
    },
    {
      key: "share",
      label: t("routeManager.fareEditor.marketShare"),
      value: `${Math.round(typed.marketShare * 100 * sharePrecision) / sharePrecision}%`,
      delta: shareDelta,
      deltaText: signed(shareDelta, points),
      tone: "text-foreground",
    },
  ];
  return (
    <div
      className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3"
      data-testid="fare-outcome"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {t("routeManager.fareEditor.outcomeTitle")}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {rows.map((row) => (
          <div key={row.key} data-testid={`fare-outcome-${row.key}`}>
            <p className="text-[10px] uppercase text-muted-foreground">{row.label}</p>
            <p className={`font-mono text-lg font-bold ${row.tone}`}>{row.value}</p>
            {saved && row.delta !== 0 ? (
              <p
                className={`font-mono text-[11px] font-semibold ${row.delta > 0 ? "text-emerald-400" : "text-rose-400"}`}
              >
                {t("routeManager.fareEditor.vsNow", { delta: row.deltaText })}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t("routeManager.fareEditor.sameAsNow")}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {t("routeManager.fareEditor.outcomeNote")}
      </p>
    </div>
  );
}
