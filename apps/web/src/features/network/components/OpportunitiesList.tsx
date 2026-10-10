import {
  type Airport,
  canonicalRouteKey,
  type FixedPoint,
  fpFormat,
  ROUTE_SLOT_FEE,
  type Route,
  type Season,
  scaleToAddressableMarket,
  TICKS_PER_HOUR,
} from "@acars/core";
import { HUB_CLASSIFICATIONS } from "@acars/data";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle2, PlusCircle, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  FIRST_HOP_MAX_HOURS,
  flightHours,
  rankByProfitPerDay,
  rankForFirstRoute,
} from "@/features/network/utils/opportunityRanking";
import type { estimateRouteEconomics } from "@/features/network/utils/routeEconomics";
import {
  NEW_ROUTE_WEEKLY_FREQUENCY,
  recommendAircraftForRoute,
} from "@/features/network/utils/routeRecommendation";
import { usePanelScrollRef } from "@/shared/components/layout/panelScrollContext";
import { useConfirm } from "@/shared/lib/useConfirm";

export type ProspectMarket = {
  origin: Airport;
  destination: Airport;
  distance: number;
  demand: { economy: number; business: number; first: number };
  estimatedDailyRevenue: FixedPoint;
  season: Season;
  routeEconomics: ReturnType<typeof estimateRouteEconomics> | null;
};

interface OpportunitiesListProps {
  /** Candidate markets, already filtered to destinations not yet served. */
  markets: ProspectMarket[];
  activeRoutes: Route[];
  isViewingOther: boolean;
  canOpenFromOrigin: boolean;
  originSlotControlled: boolean;
  searchQuery: string;
  searchResultCount: number;
}

/**
 * Route opportunities, best projected profit per day first. Each market is
 * projected with the aircraft the airport panel would recommend (S23), so the
 * figure matches what launching it there promises. Virtualized (Rule 5).
 */
export function OpportunitiesList({
  markets,
  activeRoutes,
  isViewingOther,
  canOpenFromOrigin,
  originSlotControlled,
  searchQuery,
  searchResultCount,
}: OpportunitiesListProps) {
  const { t } = useTranslation(["common", "game"]);
  const airline = useAirlineStore((s) => s.airline);
  const pubkey = useAirlineStore((s) => s.pubkey);
  const routes = useAirlineStore((s) => s.routes);
  const registry = useAirlineStore((s) => s.globalRouteRegistry);
  const openRoute = useAirlineStore((s) => s.openRoute);
  // Re-project at most once per game hour; season, prosperity and fuel move slowly.
  const hourTick = useEngineStore((s) => Math.floor(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR);
  const confirm = useConfirm();
  const [openingRouteIata, setOpeningRouteIata] = useState<string | null>(null);

  const ranked = useMemo(() => {
    const models = new Map<ProspectMarket, string>();
    const hours = new Map<ProspectMarket, number>();
    const list = rankByProfitPerDay(markets, (market) => {
      if (!airline) return null;
      const recommendation = recommendAircraftForRoute({
        originIata: market.origin.iata,
        destinationIata: market.destination.iata,
        distanceKm: market.distance,
        tier: airline.tier ?? 1,
        tick: hourTick,
        brandScore: airline.brandScore ?? 0.5,
        playerPubkey: pubkey ?? "",
        competitorOffers:
          registry?.get(canonicalRouteKey(market.origin.iata, market.destination.iata)) ?? [],
        networkRoutes: [
          ...routes,
          {
            originIata: market.origin.iata,
            destinationIata: market.destination.iata,
            frequencyPerWeek: NEW_ROUTE_WEEKLY_FREQUENCY,
          },
        ],
      });
      if (!recommendation) return null;
      models.set(market, recommendation.model.name);
      hours.set(market, flightHours(market.distance, recommendation.model.speedKmh));
      return recommendation.profitAfterLeasePerDay;
    });
    const entries = list.map((entry) => ({
      ...entry,
      modelName: models.get(entry.market) ?? null,
      hours: hours.get(entry.market) ?? null,
    }));
    // A first route should land in the first session (S55.1): short hops first.
    return routes.length === 0 ? rankForFirstRoute(entries, (entry) => entry.hours) : entries;
  }, [markets, airline, hourTick, pubkey, registry, routes]);
  const isFirstRoute = routes.length === 0;

  const panelScrollRef = usePanelScrollRef();
  const parentRef = useRef<HTMLDivElement>(null);
  // Measured in an effect — layout reads from refs during render are stale.
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    setScrollMargin(parentRef.current?.offsetTop ?? 0);
  }, []);
  const opportunitiesVirtualizer = useVirtualizer({
    count: ranked.length,
    getScrollElement: () => panelScrollRef.current,
    estimateSize: () => 220,
    overscan: 5,
    scrollMargin,
  });

  return (
    <div ref={parentRef}>
      <div
        style={{
          height: `${opportunitiesVirtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {opportunitiesVirtualizer.getVirtualItems().map((virtualItem) => {
          const market = ranked[virtualItem.index].market;
          const profitPerDay = ranked[virtualItem.index].profitPerDay;
          const recommendedModel = ranked[virtualItem.index].modelName;
          const hoursInAir = ranked[virtualItem.index].hours;
          const quickFirstHop =
            isFirstRoute &&
            hoursInAir !== null &&
            profitPerDay !== null &&
            profitPerDay > 0 &&
            hoursInAir <= FIRST_HOP_MAX_HOURS;
          const isAlreadyOpen = activeRoutes.some(
            (r) =>
              r.originIata === market.origin.iata && r.destinationIata === market.destination.iata,
          );
          const totalDemand = market.demand.economy + market.demand.business + market.demand.first;
          const addressableDemand = scaleToAddressableMarket({
            origin: market.origin.iata,
            destination: market.destination.iata,
            economy: market.demand.economy,
            business: market.demand.business,
            first: market.demand.first,
          });
          const addressableTotal =
            addressableDemand.economy + addressableDemand.business + addressableDemand.first;
          const destinationMeta = HUB_CLASSIFICATIONS[market.destination.iata];
          const destinationCapacity = destinationMeta?.baseCapacityPerHour ?? null;
          const destinationSlotControlled = destinationMeta?.slotControlled ?? false;
          const routeEconomics = market.routeEconomics;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={opportunitiesVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start - opportunitiesVirtualizer.options.scrollMargin}px)`,
              }}
            >
              <div className="group relative rounded-2xl bg-card border border-border overflow-hidden p-5 transition-all hover:border-primary/50 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-8">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-foreground tracking-tighter">
                          {market.destination.iata}
                          {market.destination.icao &&
                            market.destination.icao !== market.destination.iata && (
                              <span className="ml-2 text-xs text-muted-foreground font-mono font-normal">
                                [{market.destination.icao}]
                              </span>
                            )}
                        </span>
                        <TrendingUp className="h-4 w-4 text-accent" />
                        {quickFirstHop && (
                          <span
                            data-testid="first-hop-badge"
                            className="whitespace-nowrap rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400"
                          >
                            {t("routeManager.opportunities.quickFirstHop", {
                              ns: "game",
                              hours: Math.max(1, Math.round(hoursInAir * 10) / 10),
                            })}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-muted-foreground">
                        {market.destination.city}, {market.destination.country}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                        {t("routeManager.opportunities.totalMarket", { ns: "game" })}
                      </span>
                      <span className="text-lg font-mono font-bold">
                        {totalDemand.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                        {t("routeManager.opportunities.addressable", { ns: "game" })}
                      </span>
                      <span className="text-lg font-mono font-bold text-foreground">
                        {addressableTotal.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                        {t("routeManager.opportunities.distance", { ns: "game" })}
                      </span>
                      <span className="text-lg font-mono font-bold text-accent">
                        {Math.round(market.distance).toLocaleString()} km
                      </span>
                    </div>

                    <div className="flex flex-col" data-testid="opportunity-profit">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                        {t("routeManager.opportunities.profitPerDay", { ns: "game" })}
                      </span>
                      <span
                        className={`text-lg font-mono font-bold ${profitPerDay !== null && profitPerDay >= 0 ? "text-green-400" : "text-rose-400"}`}
                      >
                        {profitPerDay !== null
                          ? fpFormat(profitPerDay, 0)
                          : t("routeManager.opportunities.outOfRange", { ns: "game" })}
                      </span>
                      {recommendedModel && (
                        <span className="text-[10px] text-muted-foreground">
                          {t("routeManager.opportunities.withModel", {
                            ns: "game",
                            model: recommendedModel,
                          })}
                        </span>
                      )}
                    </div>
                    {destinationCapacity && (
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                          {t("routeManager.opportunities.destinationCapacity", { ns: "game" })}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {t("units.perHour", { ns: "common", value: destinationCapacity })}
                          {destinationSlotControlled
                            ? ` • ${t("routeManager.opportunities.slotControlled", { ns: "game" })}`
                            : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {isAlreadyOpen ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-bold">
                      <CheckCircle2 className="h-4 w-4" />
                      {t("routeManager.opportunities.routeOpen", { ns: "game" })}
                    </div>
                  ) : !isViewingOther ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const approved = await confirm({
                          title: t("routeManager.openRouteConfirmTitle", { ns: "game" }),
                          description: t("routeManager.openRouteConfirmDescription", {
                            ns: "game",
                            fee: fpFormat(ROUTE_SLOT_FEE, 0),
                            origin: market.origin.iata,
                            destination: market.destination.iata,
                          }),
                          confirmLabel: t("routeManager.openRouteConfirmLabel", {
                            ns: "game",
                          }),
                        });
                        if (!approved) return;
                        setOpeningRouteIata(market.destination.iata);
                        try {
                          await openRoute(
                            market.origin.iata,
                            market.destination.iata,
                            market.distance,
                          );
                        } catch (error) {
                          const message =
                            error instanceof Error
                              ? error.message
                              : t("routeManager.unknownError", { ns: "game" });
                          toast.error(t("routeManager.routeOpenFailed", { ns: "game" }), {
                            description: message,
                          });
                        } finally {
                          setOpeningRouteIata(null);
                        }
                      }}
                      disabled={!canOpenFromOrigin || openingRouteIata !== null}
                      className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:scale-105 transition-all shadow-lg shadow-primary/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {openingRouteIata === market.destination.iata ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          {t("routeManager.opening", { ns: "game" })}
                        </>
                      ) : (
                        <>
                          <PlusCircle className="h-4 w-4" />
                          {t("routeManager.openRouteWithFee", {
                            ns: "game",
                            fee: fpFormat(ROUTE_SLOT_FEE, 0),
                          })}
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
                {!isAlreadyOpen && originSlotControlled && !canOpenFromOrigin && (
                  <div className="mt-3 text-xs text-amber-400">
                    {t("routeManager.opportunities.slotFull", {
                      ns: "game",
                      origin: market.origin.iata,
                    })}
                  </div>
                )}
                <div className="mt-4 flex h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-zinc-500"
                    style={{
                      width: `${(market.demand.economy / (totalDemand || 1)) * 100}%`,
                    }}
                    title={t("routeManager.fareEditor.class.economy", { ns: "game" })}
                  />
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${(market.demand.business / (totalDemand || 1)) * 100}%`,
                    }}
                    title={t("routeManager.fareEditor.class.business", { ns: "game" })}
                  />
                  <div
                    className="h-full bg-yellow-500"
                    style={{
                      width: `${(market.demand.first / (totalDemand || 1)) * 100}%`,
                    }}
                    title={t("routeManager.fareEditor.class.first", { ns: "game" })}
                  />
                </div>
                {routeEconomics && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-[10px] font-mono">
                    <div className="rounded-lg border border-border/30 bg-background/30 px-3 py-2">
                      <div className="text-[9px] uppercase text-muted-foreground font-semibold">
                        {t("routeManager.opportunities.costPerFlight", { ns: "game" })}
                      </div>
                      <div className="mt-1 font-bold text-foreground">
                        {fpFormat(routeEconomics.costPerFlight, 0)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/30 bg-background/30 px-3 py-2">
                      <div className="text-[9px] uppercase text-muted-foreground font-semibold">
                        {t("routeManager.opportunities.breakEven", { ns: "game" })}
                      </div>
                      <div className="mt-1 font-bold text-foreground">
                        {Math.round(routeEconomics.breakEvenLoadFactor * 100)}%
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/30 bg-background/30 px-3 py-2">
                      <div className="text-[9px] uppercase text-muted-foreground font-semibold">
                        {t("routeManager.opportunities.suggestedFleet", { ns: "game" })}
                      </div>
                      <div className="mt-1 font-bold text-foreground">
                        {t("routeManager.opportunities.aircraftCount", {
                          ns: "game",
                          count: routeEconomics.recommendedAircraftCount,
                        })}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/30 bg-background/30 px-3 py-2">
                      <div className="text-[9px] uppercase text-muted-foreground font-semibold">
                        {t("routeManager.opportunities.costSplit", { ns: "game" })}
                      </div>
                      <div className="mt-1 text-[9px] text-muted-foreground">
                        {t("routeManager.opportunities.fuelCrew", {
                          ns: "game",
                          fuel: fpFormat(routeEconomics.costBreakdown.fuel, 0),
                          crew: fpFormat(routeEconomics.costBreakdown.crew, 0),
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {searchQuery.length > 0 && searchQuery.length < 2 && (
        <div className="p-8 text-center text-muted-foreground font-bold italic">
          {t("routeManager.opportunities.searchMinChars", { ns: "game" })}
        </div>
      )}
      {searchQuery.length >= 2 && searchResultCount === 0 && (
        <div className="p-8 text-center text-muted-foreground font-bold italic">
          {t("routeManager.opportunities.searchNoResults", { ns: "game", query: searchQuery })}
        </div>
      )}
    </div>
  );
}
