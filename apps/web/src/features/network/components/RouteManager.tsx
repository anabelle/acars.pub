import {
  type Airport,
  calculateDemand,
  calculateShares,
  canonicalRouteKey,
  computeRouteFrequency,
  type FlightOffer,
  fpAdd,
  fpFormat,
  fpScale,
  getProsperityIndex,
  getSeason,
  getSuggestedFares,
  haversineDistance,
  NATURAL_LF_CEILING,
  scaleToAddressableMarket,
  TICKS_PER_DAY,
} from "@acars/core";
import { getAircraftById, getAirports, HUB_CLASSIFICATIONS } from "@acars/data";
import { useActiveAirline, useAirlineStore, useEngineStore } from "@acars/store";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Globe,
  MapPin,
  Search,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { AirlineFlightBoard } from "@/features/network/components/AirlineFlightBoard";
import { AssignAircraftDialog } from "@/features/network/components/AssignAircraftDialog";
import { FareEditor, type FareEditorTarget } from "@/features/network/components/FareEditor";
import {
  OpportunitiesList,
  type ProspectMarket,
} from "@/features/network/components/OpportunitiesList";
import { RouteFrequencyControl } from "@/features/network/components/RouteFrequencyControl";
import { getRouteDemandSnapshotCached } from "@/features/network/hooks/useRouteDemand";
import {
  getElasticityTone,
  getFareTone,
  toneDotClass,
  toneTextClass,
} from "@/features/network/utils/fareTones";
import { candidateDestinations } from "@/features/network/utils/hubOpportunities";
import {
  estimateRouteEconomics,
  getPrimaryAssignedAircraft,
} from "@/features/network/utils/routeEconomics";
import { LiveryThumb } from "@/shared/components/LiveryThumb";
import { PanelHeader } from "@/shared/components/layout/PanelLayout";
import { usePanelScrollRef } from "@/shared/components/layout/panelScrollContext";
import { navigateToAirport } from "@/shared/lib/permalinkNavigation";
import { useConfirm } from "@/shared/lib/useConfirm";

// ---------------------------------------------------------------------------
// Prospect markets (the Opportunities tab): the most populous unserved
// airports in range, memoized per (origin, game day, tier, served set) since
// season and prosperity only move meaningfully per game day.
// ---------------------------------------------------------------------------
/** How many destinations the Opportunities tab projects (one recommendation each). */
const PROSPECT_COUNT = 24;
const prospectsMemo = new Map<string, ProspectMarket[]>();
const PROSPECTS_MEMO_MAX_ENTRIES = 8;

function buildProspects(
  origin: Airport,
  tick: number,
  tier: number,
  served: ReadonlySet<string>,
): ProspectMarket[] {
  const now = new Date();
  const prosperity = getProsperityIndex(tick);
  // The most populous unserved airports in the tier's range (S55.1). This
  // replaced a sample of the 2 nearest, 2 middling and 2 farthest airports in
  // the world, which offered a new airline 10 km hops and out-of-range routes.
  const picks = candidateDestinations(origin, getAirports(), tier, served, PROSPECT_COUNT).map(
    (candidate) => candidate.airport,
  );

  return picks.map((dest) => {
    const season = getSeason(dest.latitude, now);
    const distance = haversineDistance(
      origin.latitude,
      origin.longitude,
      dest.latitude,
      dest.longitude,
    );
    const demand = calculateDemand(origin, dest, season, prosperity, 1.0);
    const addressableDemand = scaleToAddressableMarket(demand);
    const fares = getSuggestedFares(distance);
    const estimatedDailyRevenue = fpAdd(
      fpAdd(
        fpScale(fares.economy, demand.economy / 7),
        fpScale(fares.business, demand.business / 7),
      ),
      fpScale(fares.first, demand.first / 7),
    );
    const sampleModel = getAircraftById("atr72-600") ?? getAircraftById("a320neo");
    const routeEconomics = sampleModel
      ? estimateRouteEconomics({
          route: {
            originIata: origin.iata,
            destinationIata: dest.iata,
            distanceKm: distance,
            fareEconomy: fares.economy,
            fareBusiness: fares.business,
            fareFirst: fares.first,
          },
          addressableDemand,
          pressureMultiplier: 0.85,
          effectiveLoadFactor: 0.85,
          aircraft: sampleModel,
          aircraftCount: 1,
          cabinConfig: sampleModel.capacity,
          tick,
        })
      : null;
    return {
      origin,
      destination: dest,
      distance,
      demand,
      estimatedDailyRevenue,
      season,
      routeEconomics,
    };
  });
}

function getProspectMarkets(
  origin: Airport,
  tick: number,
  tier: number,
  served: ReadonlySet<string>,
): ProspectMarket[] {
  const dayBucket = Math.floor(tick / TICKS_PER_DAY);
  const memoKey = `${origin.iata}:${dayBucket}:${tier}:${[...served].sort().join(",")}`;
  const memoized = prospectsMemo.get(memoKey);
  if (memoized) return memoized;
  const built = buildProspects(origin, dayBucket * TICKS_PER_DAY, tier, served);
  if (prospectsMemo.size >= PROSPECTS_MEMO_MAX_ENTRIES) prospectsMemo.clear();
  prospectsMemo.set(memoKey, built);
  return built;
}

export function RouteManager() {
  const { t } = useTranslation(["common", "game"]);
  const { airline, routes, fleet, isViewingOther } = useActiveAirline();
  const fleetById = useMemo(() => new Map(fleet.map((ac) => [ac.id, ac])), [fleet]);
  // Fine-grained selectors — the previous whole-store subscription re-rendered
  // this 2k-LOC tree on every write of any airline-store slice.
  const pubkey = useAirlineStore((s) => s.pubkey);
  const globalRouteRegistry = useAirlineStore((s) => s.globalRouteRegistry);
  const competitors = useAirlineStore((s) => s.competitors);
  const { rebaseRoute, closeRoute } = useAirlineStore(
    useShallow((s) => ({
      rebaseRoute: s.rebaseRoute,
      closeRoute: s.closeRoute,
    })),
  );
  const confirm = useConfirm();
  const homeAirport = useEngineStore((s) => s.homeAirport);
  const tick = useEngineStore((s) => s.tick);
  const setActiveHubIata = useEngineStore((s) => s.setActiveHubIata);
  const { tab } = useSearch({ from: "/network" });
  const navigate = useNavigate({ from: "/network" });
  const setTab = (newTab: "active" | "opportunities") => {
    navigate({ search: { tab: newTab } });
  };
  const [fareEditor, setFareEditor] = useState<FareEditorTarget | null>(null);
  const [assignRouteId, setAssignRouteId] = useState<string | null>(null);
  const assignRoute = assignRouteId ? routes.find((route) => route.id === assignRouteId) : null;
  const [searchQuery, setSearchQuery] = useState("");
  const [rebaseTargets, setRebaseTargets] = useState<Record<string, string>>({});
  const [planningOriginIata, setPlanningOriginIata] = useState<string | null>(
    airline?.hubs?.[0] ?? null,
  );

  const airportIndex = useMemo(
    () => new Map(getAirports().map((airport) => [airport.iata, airport])),
    [],
  );

  useEffect(() => {
    if (!airline?.hubs?.length) return;
    if (!planningOriginIata || !airline.hubs.includes(planningOriginIata)) {
      setPlanningOriginIata(airline.hubs[0]);
    }
  }, [airline?.hubs, planningOriginIata]);

  useEffect(() => {
    if (planningOriginIata) {
      setActiveHubIata(planningOriginIata, "route planner");
    }
  }, [planningOriginIata, setActiveHubIata]);

  const planningOriginAirport = useMemo(() => {
    if (planningOriginIata) {
      return airportIndex.get(planningOriginIata) ?? null;
    }
    if (airline?.hubs?.length) {
      return airportIndex.get(airline.hubs[0]) ?? null;
    }
    return homeAirport;
  }, [planningOriginIata, airline?.hubs, airportIndex, homeAirport]);

  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    return getAirports()
      .filter(
        (airport) =>
          airport.iata !== planningOriginAirport?.iata &&
          (airport.iata?.toLowerCase().includes(query) ||
            airport.icao?.toLowerCase().includes(query) ||
            airport.city?.toLowerCase().includes(query) ||
            airport.name?.toLowerCase().includes(query)),
      )
      .slice(0, 5);
  }, [searchQuery, planningOriginAirport?.iata]);

  const calculateSearchProspect = useCallback(
    (dest: Airport): ProspectMarket | null => {
      if (!planningOriginAirport) return null;
      const now = new Date();
      const prosperity = getProsperityIndex(tick);
      const season = getSeason(dest.latitude, now);
      const distance = haversineDistance(
        planningOriginAirport.latitude,
        planningOriginAirport.longitude,
        dest.latitude,
        dest.longitude,
      );
      const demand = calculateDemand(planningOriginAirport, dest, season, prosperity, 1.0);
      const addressableDemand = scaleToAddressableMarket(demand);
      const fares = getSuggestedFares(distance);
      const estimatedDailyRevenue = fpAdd(
        fpAdd(
          fpScale(fares.economy, demand.economy / 7),
          fpScale(fares.business, demand.business / 7),
        ),
        fpScale(fares.first, demand.first / 7),
      );
      const sampleModel = getAircraftById("atr72-600") ?? getAircraftById("a320neo");
      const routeEconomics = sampleModel
        ? estimateRouteEconomics({
            route: {
              originIata: planningOriginAirport.iata,
              destinationIata: dest.iata,
              distanceKm: distance,
              fareEconomy: fares.economy,
              fareBusiness: fares.business,
              fareFirst: fares.first,
            },
            addressableDemand,
            pressureMultiplier: 0.85,
            effectiveLoadFactor: 0.85,
            aircraft: sampleModel,
            aircraftCount: 1,
            cabinConfig: sampleModel.capacity,
            tick,
          })
        : null;
      return {
        origin: planningOriginAirport,
        destination: dest,
        distance,
        demand,
        estimatedDailyRevenue,
        season,
        routeEconomics,
      };
    },
    [planningOriginAirport, tick],
  );

  // Memoized per (origin, game-day bucket) at module level — see
  // getProspectMarkets. The heavy 6k-airport sort runs once per origin.
  const tier = airline?.tier ?? 1;
  const servedKey = routes
    .filter((r) => r.status === "active" && r.originIata === planningOriginAirport?.iata)
    .map((r) => r.destinationIata)
    .sort()
    .join(",");
  const prospectMarkets = useMemo(
    () =>
      planningOriginAirport
        ? getProspectMarkets(
            planningOriginAirport,
            tick,
            tier,
            new Set(servedKey ? servedKey.split(",") : []),
          )
        : [],
    [planningOriginAirport, tick, tier, servedKey],
  );

  const activeRoutes = useMemo(
    () => [...routes].reverse().filter((route) => route.status === "active"),
    [routes],
  );
  const suspendedRoutes = useMemo(
    () => routes.filter((route) => route.status === "suspended"),
    [routes],
  );
  // Unbounded-list guard: cap rendered suspended-route cards, expand on demand.
  const SUSPENDED_ROUTES_PREVIEW_LIMIT = 50;
  const [showAllSuspendedRoutes, setShowAllSuspendedRoutes] = useState(false);
  const suspendedRoutesToShow = showAllSuspendedRoutes
    ? suspendedRoutes
    : suspendedRoutes.slice(0, SUSPENDED_ROUTES_PREVIEW_LIMIT);
  const originActiveRoutes = useMemo(() => {
    if (!planningOriginAirport) return [];
    return activeRoutes.filter((route) => route.originIata === planningOriginAirport.iata);
  }, [activeRoutes, planningOriginAirport]);

  const originHubMeta = planningOriginAirport
    ? HUB_CLASSIFICATIONS[planningOriginAirport.iata]
    : undefined;
  const originCapacityPerHour = originHubMeta?.baseCapacityPerHour ?? 0;
  const originSlotControlled = originHubMeta?.slotControlled ?? false;
  const currentOriginHourlyFlights = useMemo(() => {
    if (!planningOriginAirport) return 0;
    return routes.reduce((total, route) => {
      if (
        route.originIata !== planningOriginAirport.iata &&
        route.destinationIata !== planningOriginAirport.iata
      )
        return total;
      const weekly = route.frequencyPerWeek ?? 0;
      return total + weekly / (7 * 24);
    }, 0);
  }, [planningOriginAirport, routes]);
  const nextRouteHourly = 7 / (7 * 24);
  const projectedOriginHourly = currentOriginHourlyFlights + nextRouteHourly;
  const canOpenFromOrigin = !originSlotControlled || projectedOriginHourly <= originCapacityPerHour;

  // --- Virtualization (hooks must come before any conditional return) ---
  const panelScrollRef = usePanelScrollRef();
  const listParentRef = useRef<HTMLDivElement>(null);
  // Measured in an effect — layout reads from refs during render are stale.
  // Re-measured on tab switch because the list container remounts per tab.
  const [listScrollMargin, setListScrollMargin] = useState(0);
  useEffect(() => {
    setListScrollMargin(listParentRef.current?.offsetTop ?? 0);
  }, [tab]);

  const displayedOpportunities = useMemo(() => {
    const activeDests = new Set(originActiveRoutes.map((r) => r.destinationIata));
    const candidates =
      searchQuery.length >= 2
        ? searchResults.map(calculateSearchProspect).filter((m): m is ProspectMarket => Boolean(m))
        : prospectMarkets;
    return candidates.filter((m) => !activeDests.has(m.destination.iata));
  }, [searchQuery, searchResults, prospectMarkets, originActiveRoutes, calculateSearchProspect]);

  const activeRoutesVirtualizer = useVirtualizer({
    count: activeRoutes.length,
    getScrollElement: () => panelScrollRef.current,
    estimateSize: () => 420,
    overscan: 3,
    scrollMargin: listScrollMargin,
  });

  if (!airline || !homeAirport || !planningOriginAirport) return null;

  return (
    <div className="flex flex-col">
      <PanelHeader
        title={t("routeManager.pageTitle", { ns: "game" })}
        subtitle={t("routeManager.subtitle", {
          ns: "game",
          airport: planningOriginAirport.name,
        })}
        badge={
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary sm:px-3 sm:text-xs">
            {t("routeManager.activeBadge", {
              ns: "game",
              count: activeRoutes.length,
            })}
          </span>
        }
      />

      <div className="flex flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4">
        <div className="mb-3 rounded-2xl border border-border/50 bg-card/90 p-3 shadow-sm backdrop-blur-xl sm:p-4">
          <div className="flex flex-col gap-3">
            {airline.hubs.length > 1 ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
                <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                <select
                  aria-label={t("routeManager.selectPlanningHub", {
                    ns: "game",
                  })}
                  value={planningOriginIata ?? ""}
                  onChange={(event) => setPlanningOriginIata(event.target.value || null)}
                  className="h-9 flex-1 rounded-lg border border-border/50 bg-background px-3 text-xs font-bold text-foreground sm:flex-none"
                >
                  {airline.hubs.map((hub) => (
                    <option key={hub} value={hub}>
                      {hub}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="grid grid-cols-2 rounded-xl border border-border/50 bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => setTab("active")}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition-all sm:text-sm ${tab === "active" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t("routeManager.activeTab", {
                  ns: "game",
                  count: activeRoutes.length,
                })}
              </button>
              <button
                type="button"
                onClick={() => setTab("opportunities")}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition-all sm:text-sm ${tab === "opportunities" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t("network.opportunities", { ns: "game" })}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          {suspendedRoutes.length > 0 && !isViewingOther && (
            <div className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
                    {t("routeManager.suspended.title", { ns: "game" })}
                  </p>
                  <p className="text-sm text-amber-100/80 mt-2">
                    {t("routeManager.suspended.description", { ns: "game" })}
                  </p>
                </div>
                <div className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200">
                  {t("routeManager.suspended.awaitingRebase", {
                    ns: "game",
                    count: suspendedRoutes.length,
                  })}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3">
                {suspendedRoutesToShow.map((route) => (
                  <div
                    key={route.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-background/70 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigateToAirport(route.originIata)}
                          className="hover:text-primary transition-colors cursor-pointer"
                        >
                          {route.originIata}
                        </button>
                        <span className="text-muted-foreground">→</span>
                        <button
                          type="button"
                          onClick={() => navigateToAirport(route.destinationIata)}
                          className="hover:text-primary transition-colors cursor-pointer"
                        >
                          {route.destinationIata}
                        </button>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t("routeManager.card.distance", {
                          ns: "game",
                          km: Math.round(route.distanceKm).toLocaleString(),
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {airline.hubs.some((hub) => hub !== route.destinationIata) ? (
                        <>
                          <select
                            value={
                              rebaseTargets[route.id] ??
                              airline.hubs.find((hub) => hub !== route.destinationIata) ??
                              ""
                            }
                            onChange={(e) =>
                              setRebaseTargets((prev) => ({
                                ...prev,
                                [route.id]: e.target.value,
                              }))
                            }
                            className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-bold text-foreground"
                          >
                            {airline.hubs
                              .filter((hub) => hub !== route.destinationIata)
                              .map((hub) => (
                                <option key={hub} value={hub}>
                                  {hub}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={async () => {
                              const fallbackHub = airline.hubs.find(
                                (hub) => hub !== route.destinationIata,
                              );
                              const targetHub = rebaseTargets[route.id] ?? fallbackHub;
                              if (!targetHub) return;
                              try {
                                await rebaseRoute(route.id, targetHub);
                              } catch (err) {
                                const message =
                                  err instanceof Error
                                    ? err.message
                                    : t("routeManager.routeRebaseFailed", {
                                        ns: "game",
                                      });
                                toast.error(
                                  t("routeManager.routeRebaseFailed", {
                                    ns: "game",
                                  }),
                                  {
                                    description: message,
                                  },
                                );
                              }
                            }}
                            className="h-9 rounded-lg bg-amber-500 px-3 text-xs font-bold text-amber-950 hover:bg-amber-400 transition"
                          >
                            {t("routeManager.rebaseToHub", { ns: "game" })}
                          </button>
                        </>
                      ) : (
                        <div className="text-xs font-bold text-amber-100/70">
                          {t("routeManager.openAnotherHubToRebase", {
                            ns: "game",
                          })}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          const approved = await confirm({
                            title: t("routeManager.closeRouteTitle", {
                              ns: "game",
                            }),
                            description: t("routeManager.closeRouteDescription", {
                              ns: "game",
                              origin: route.originIata,
                              destination: route.destinationIata,
                            }),
                            confirmLabel: t("routeManager.closeRoute", {
                              ns: "game",
                            }),
                            tone: "destructive",
                          });
                          if (!approved) return;
                          try {
                            await closeRoute(route.id);
                          } catch (err) {
                            const message =
                              err instanceof Error
                                ? err.message
                                : t("routeManager.routeCloseFailed", {
                                    ns: "game",
                                  });
                            toast.error(
                              t("routeManager.routeCloseFailed", {
                                ns: "game",
                              }),
                              {
                                description: message,
                              },
                            );
                          }
                        }}
                        className="h-9 rounded-lg border border-amber-500/30 bg-transparent px-3 text-xs font-bold text-amber-100 hover:bg-amber-500/20 transition"
                      >
                        {t("routeManager.closeRoute", { ns: "game" })}
                      </button>
                    </div>
                  </div>
                ))}
                {suspendedRoutes.length > SUSPENDED_ROUTES_PREVIEW_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setShowAllSuspendedRoutes((value) => !value)}
                    className="mt-1 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/20"
                  >
                    {showAllSuspendedRoutes
                      ? t("routeManager.showFewerSuspended", { ns: "game" })
                      : t("routeManager.showAllSuspended", {
                          ns: "game",
                          count: suspendedRoutes.length,
                        })}
                  </button>
                )}
              </div>
            </div>
          )}
          {tab === "opportunities" && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 p-3 sm:p-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  name="routeSearch"
                  placeholder={t("routeManager.searchPlaceholder", {
                    ns: "game",
                  })}
                  className="w-full bg-background border border-border/50 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-bold"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  aria-label={t("routeManager.searchAria", { ns: "game" })}
                />
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  {t("actions.clear", { ns: "common" })}
                </button>
              )}
            </div>
          )}

          {tab === "active" ? (
            <>
              <AirlineFlightBoard />
              {activeRoutes.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/50 bg-muted/20 px-5 py-10 sm:h-64">
                  <Globe className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground font-medium">
                    {t("routeManager.networkEmpty", { ns: "game" })}
                  </p>
                  {!isViewingOther && (
                    <button
                      type="button"
                      onClick={() => setTab("opportunities")}
                      className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                    >
                      {t("routeManager.browseOpportunities", { ns: "game" })}
                    </button>
                  )}
                </div>
              ) : (
                <div ref={listParentRef}>
                  <div
                    style={{
                      height: `${activeRoutesVirtualizer.getTotalSize()}px`,
                      position: "relative",
                    }}
                  >
                    {activeRoutesVirtualizer.getVirtualItems().map((virtualItem) => {
                      const route = activeRoutes[virtualItem.index];
                      const destinationAirport = airportIndex.get(route.destinationIata);
                      const assignedCount = route.assignedAircraftIds.length;
                      // Cached per (route, demand bucket) — recomputing the full
                      // snapshot for every visible row on every tick was quadratic.
                      const demandSnapshot = getRouteDemandSnapshotCached(
                        route,
                        tick,
                        fleet,
                        routes,
                      );
                      const { addressableDemand } = demandSnapshot;
                      const marketDemand =
                        demandSnapshot.totalDemand.economy +
                        demandSnapshot.totalDemand.business +
                        demandSnapshot.totalDemand.first;
                      const addressableTotal =
                        addressableDemand.economy +
                        addressableDemand.business +
                        addressableDemand.first;
                      const totalWeeklySeats = demandSnapshot.totalWeeklySeats;
                      const loadFactor = Math.round(demandSnapshot.pressureMultiplier * 100);
                      const supplyRatio =
                        addressableTotal > 0 ? totalWeeklySeats / addressableTotal : 0;
                      const lfTone =
                        loadFactor >= 80
                          ? "text-emerald-400"
                          : loadFactor >= 60
                            ? "text-amber-400"
                            : "text-rose-400";
                      const lfFill =
                        loadFactor >= 80
                          ? "bg-emerald-500"
                          : loadFactor >= 60
                            ? "bg-amber-500"
                            : "bg-rose-500";
                      const supplyLabel =
                        supplyRatio > 1.05
                          ? t("routeManager.card.supply.over", { ns: "game" })
                          : supplyRatio < 0.7
                            ? t("routeManager.card.supply.under", { ns: "game" })
                            : t("routeManager.card.supply.balanced", { ns: "game" });
                      const economyTone = getFareTone(
                        route.fareEconomy,
                        demandSnapshot.referenceFareEconomy,
                      );
                      const businessTone = getFareTone(
                        route.fareBusiness,
                        demandSnapshot.referenceFareBusiness,
                      );
                      const firstTone = getFareTone(
                        route.fareFirst,
                        demandSnapshot.referenceFareFirst,
                      );
                      const economyElasticity = demandSnapshot.elasticityEconomy;
                      const businessElasticity = demandSnapshot.elasticityBusiness;
                      const firstElasticity = demandSnapshot.elasticityFirst;
                      const showPriceEffect =
                        Math.abs(1 - economyElasticity) > 0.05 ||
                        Math.abs(1 - businessElasticity) > 0.05 ||
                        Math.abs(1 - firstElasticity) > 0.05;
                      const primaryAssignment = getPrimaryAssignedAircraft(
                        route.assignedAircraftIds,
                        fleet,
                        getAircraftById,
                      );
                      const routeEconomics = primaryAssignment
                        ? estimateRouteEconomics({
                            route,
                            addressableDemand: demandSnapshot.addressableDemand,
                            pressureMultiplier: demandSnapshot.pressureMultiplier,
                            effectiveLoadFactor: demandSnapshot.effectiveLoadFactor,
                            aircraft: primaryAssignment.model,
                            aircraftCount: Math.max(1, route.assignedAircraftIds.length),
                            cabinConfig: primaryAssignment.aircraft.configuration,
                            includeFixedCosts: true,
                            tick,
                          })
                        : null;

                      return (
                        <div
                          key={virtualItem.key}
                          data-index={virtualItem.index}
                          ref={activeRoutesVirtualizer.measureElement}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualItem.start - activeRoutesVirtualizer.options.scrollMargin}px)`,
                          }}
                        >
                          <div className="group relative rounded-2xl bg-card border border-border overflow-hidden p-4 sm:p-5 transition-all hover:border-primary/50 hover:shadow-md mb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                                <div className="flex flex-col">
                                  <span className="text-2xl font-black text-primary leading-none tracking-tighter flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => navigateToAirport(route.originIata)}
                                      className="hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      {route.originIata}
                                    </button>
                                    <span className="text-muted-foreground">→</span>
                                    <button
                                      type="button"
                                      onClick={() => navigateToAirport(route.destinationIata)}
                                      className="hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      {route.destinationIata}
                                    </button>
                                  </span>
                                  <span className="text-xs text-muted-foreground font-semibold mt-1">
                                    {destinationAirport?.city}, {destinationAirport?.country} •{" "}
                                    {Math.round(route.distanceKm).toLocaleString()}
                                    km
                                  </span>
                                </div>

                                <div className="hidden sm:block h-10 w-px bg-border/50" />

                                <div className="flex flex-col">
                                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                                    {t("routeManager.pricing", { ns: "game" })}
                                  </span>
                                  <div className="flex gap-3 mt-1">
                                    <span className="text-xs font-mono bg-zinc-500/10 px-2 py-0.5 rounded border border-zinc-500/20 inline-flex items-center gap-1.5">
                                      {economyTone && (
                                        <span
                                          className={`h-1.5 w-1.5 rounded-full ${toneDotClass[economyTone]}`}
                                        />
                                      )}
                                      E: {fpFormat(route.fareEconomy, 0)}
                                    </span>
                                    <span className="text-xs font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-blue-400 inline-flex items-center gap-1.5">
                                      {businessTone && (
                                        <span
                                          className={`h-1.5 w-1.5 rounded-full ${toneDotClass[businessTone]}`}
                                        />
                                      )}
                                      B: {fpFormat(route.fareBusiness, 0)}
                                    </span>
                                    <span className="text-xs font-mono bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20 text-yellow-500 inline-flex items-center gap-1.5">
                                      {firstTone && (
                                        <span
                                          className={`h-1.5 w-1.5 rounded-full ${toneDotClass[firstTone]}`}
                                        />
                                      )}
                                      F: {fpFormat(route.fareFirst, 0)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                {!isViewingOther ? <RouteFrequencyControl route={route} /> : null}
                                <div className="flex flex-col text-right">
                                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                                    {t("routeManager.card.fleet", { ns: "game" })}
                                  </span>
                                  <span
                                    className={`text-sm font-bold mt-1 ${assignedCount > 0 ? "text-foreground" : "text-red-400 flex items-center gap-1 justify-end"}`}
                                  >
                                    {assignedCount === 0 && <AlertCircle className="h-3 w-3" />}
                                    {t("routeManager.card.aircraftAssigned", {
                                      ns: "game",
                                      count: assignedCount,
                                    })}
                                  </span>
                                  {assignedCount > 0 ? (
                                    <span
                                      className="mt-1 flex justify-end -space-x-2"
                                      data-testid="route-liveries"
                                    >
                                      {route.assignedAircraftIds.slice(0, 4).map((aircraftId) => {
                                        const ac = fleetById.get(aircraftId);
                                        if (!ac) return null;
                                        return (
                                          <LiveryThumb
                                            key={aircraftId}
                                            imageUrl={ac.liveryImageUrl}
                                            familyId={getAircraftById(ac.modelId)?.familyId}
                                            color={airline?.livery.primary}
                                            alt={ac.name}
                                            size="xs"
                                            className="ring-2 ring-card"
                                          />
                                        );
                                      })}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="flex items-center gap-2">
                                  {!isViewingOther && (
                                    <>
                                      <button
                                        type="button"
                                        data-testid="route-add-aircraft"
                                        onClick={() => setAssignRouteId(route.id)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                          assignedCount === 0
                                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                            : "bg-white/5 text-white/60 border border-white/5 hover:bg-white/10"
                                        }`}
                                      >
                                        {t("assign.addAircraft", { ns: "game" })}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFareEditor({
                                            routeId: route.id,
                                            originIata: route.originIata,
                                            destinationIata: route.destinationIata,
                                            distanceKm: route.distanceKm,
                                          });
                                        }}
                                        className="px-4 py-2 bg-white/5 text-white/60 border border-white/5 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
                                      >
                                        {t("routeManager.editFares", {
                                          ns: "game",
                                        })}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const approved = await confirm({
                                            title: t("routeManager.closeRouteTitle", {
                                              ns: "game",
                                            }),
                                            description: t("routeManager.closeRouteDescription", {
                                              ns: "game",
                                              origin: route.originIata,
                                              destination: route.destinationIata,
                                            }),
                                            confirmLabel: t("routeManager.closeRoute", {
                                              ns: "game",
                                            }),
                                            tone: "destructive",
                                          });
                                          if (!approved) return;
                                          try {
                                            await closeRoute(route.id);
                                          } catch (err) {
                                            const message =
                                              err instanceof Error
                                                ? err.message
                                                : t("routeManager.routeCloseFailed", {
                                                    ns: "game",
                                                  });
                                            toast.error(
                                              t("routeManager.routeCloseFailed", { ns: "game" }),
                                              {
                                                description: message,
                                              },
                                            );
                                          }
                                        }}
                                        className="px-3 py-2 rounded-xl border border-red-500/30 text-red-200/80 text-sm font-bold hover:bg-red-500/15 transition-all"
                                      >
                                        {t("routeManager.closeRoute", {
                                          ns: "game",
                                        })}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Market Supply / Demand */}
                            {addressableDemand && (
                              <div className="mt-3 rounded-xl sm:rounded-2xl border border-border/40 bg-muted/20 p-3 sm:p-4">
                                <div className="flex items-center justify-between mb-2 sm:mb-3">
                                  <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                    <TrendingUp className="h-3 w-3" />{" "}
                                    {t("routeManager.marketSupply", { ns: "game" })}
                                  </span>
                                  <span className={`text-[10px] font-bold uppercase ${lfTone}`}>
                                    {supplyLabel}
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 sm:gap-3 text-[10px] font-mono">
                                  <div className="flex flex-col gap-1 rounded-lg border border-border/30 bg-background/40 px-2 py-1.5">
                                    <span className="text-[9px] uppercase text-muted-foreground font-semibold">
                                      {t("routeManager.totalMarket", { ns: "game" })}
                                    </span>
                                    <span className="text-foreground font-bold">
                                      {t("units.perWeek", {
                                        ns: "common",
                                        value: marketDemand.toLocaleString(),
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-1 rounded-lg border border-border/30 bg-background/40 px-2 py-1.5">
                                    <span className="text-[9px] uppercase text-muted-foreground font-semibold">
                                      {t("routeManager.addressable", { ns: "game" })}
                                    </span>
                                    <span className="text-foreground font-bold">
                                      {t("units.perWeek", {
                                        ns: "common",
                                        value: addressableTotal.toLocaleString(),
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-1 rounded-lg border border-border/30 bg-background/40 px-2 py-1.5">
                                    <span className="text-[9px] uppercase text-muted-foreground font-semibold">
                                      {t("routeManager.yourSeats", { ns: "game" })}
                                    </span>
                                    <span className="text-foreground font-bold">
                                      {t("units.perWeek", {
                                        ns: "common",
                                        value: totalWeeklySeats.toLocaleString(),
                                      })}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <div className="flex justify-between text-[10px] font-semibold">
                                    <span className="text-muted-foreground uppercase">
                                      {t("routeManager.card.supplyPressure", { ns: "game" })}
                                    </span>
                                    <span className={lfTone}>
                                      {t("routeManager.card.seatsFilledPct", {
                                        ns: "game",
                                        value: loadFactor,
                                      })}
                                    </span>
                                  </div>
                                  <div className="mt-1 h-2 w-full rounded-full bg-background/70 overflow-hidden">
                                    <div
                                      className={`h-full ${lfFill} transition-all duration-500`}
                                      style={{
                                        width: `${Math.min(100, loadFactor)}%`,
                                      }}
                                    />
                                  </div>
                                  <div className="mt-2 flex justify-between text-[9px] text-muted-foreground">
                                    <span>
                                      {t("routeManager.card.target", {
                                        ns: "game",
                                        value: Math.round(NATURAL_LF_CEILING * 100),
                                      })}
                                    </span>
                                    <span>
                                      {supplyRatio > 1.05
                                        ? t("routeManager.card.oversupply", {
                                            ns: "game",
                                            ratio: supplyRatio.toFixed(2),
                                          })
                                        : t("routeManager.card.coverage", {
                                            ns: "game",
                                            ratio: supplyRatio.toFixed(2),
                                          })}
                                    </span>
                                  </div>
                                  {showPriceEffect && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                                      <span className="uppercase text-muted-foreground">
                                        {t("routeManager.card.priceEffect", { ns: "game" })}
                                      </span>
                                      <span
                                        className={`font-mono ${toneTextClass[getElasticityTone(economyElasticity)]}`}
                                      >
                                        E: {economyElasticity.toFixed(2)}x
                                      </span>
                                      <span
                                        className={`font-mono ${toneTextClass[getElasticityTone(businessElasticity)]}`}
                                      >
                                        B: {businessElasticity.toFixed(2)}x
                                      </span>
                                      <span
                                        className={`font-mono ${toneTextClass[getElasticityTone(firstElasticity)]}`}
                                      >
                                        F: {firstElasticity.toFixed(2)}x
                                      </span>
                                    </div>
                                  )}
                                  {demandSnapshot.suggestedFleetDelta !== 0 && (
                                    <div className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold">
                                      {demandSnapshot.suggestedFleetDelta > 0 ? (
                                        <>
                                          <ArrowUp className="h-3 w-3 text-emerald-400" />
                                          <span className="text-emerald-400">
                                            {t("routeManager.card.aircraftSuggested", {
                                              ns: "game",
                                              count: demandSnapshot.suggestedFleetDelta,
                                              delta: `+${demandSnapshot.suggestedFleetDelta}`,
                                            })}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <ArrowDown className="h-3 w-3 text-amber-400" />
                                          <span className="text-amber-400">
                                            {t("routeManager.card.aircraftSuggested", {
                                              ns: "game",
                                              count: demandSnapshot.suggestedFleetDelta,
                                              delta: demandSnapshot.suggestedFleetDelta,
                                            })}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  )}

                                  {routeEconomics && (
                                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 text-[10px] font-mono">
                                      <div className="rounded-lg border border-border/30 bg-background/40 px-2 py-2">
                                        <div className="text-[9px] uppercase text-muted-foreground font-semibold">
                                          {t("routeManager.card.profitPerFlight", { ns: "game" })}
                                        </div>
                                        <div
                                          className={`mt-1 font-bold ${routeEconomics.profitPerFlight >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                                        >
                                          {fpFormat(routeEconomics.profitPerFlight, 0)}
                                        </div>
                                        <div className="mt-1 text-[9px] text-muted-foreground">
                                          {t("routeManager.card.revCost", {
                                            ns: "game",
                                            revenue: fpFormat(routeEconomics.revenuePerFlight, 0),
                                            cost: fpFormat(routeEconomics.costPerFlight, 0),
                                          })}
                                        </div>
                                      </div>
                                      <div className="rounded-lg border border-border/30 bg-background/40 px-2 py-2">
                                        <div className="text-[9px] uppercase text-muted-foreground font-semibold">
                                          {t("routeManager.card.breakEven", { ns: "game" })}
                                        </div>
                                        <div className="mt-1 font-bold text-foreground">
                                          {Math.round(routeEconomics.breakEvenLoadFactor * 100)}%
                                        </div>
                                        <div className="mt-1 text-[9px] text-muted-foreground">
                                          {t("routeManager.card.currentEstimate", {
                                            ns: "game",
                                            value: Math.round(
                                              routeEconomics.estimatedLoadFactor * 100,
                                            ),
                                          })}
                                        </div>
                                      </div>
                                      <div className="rounded-lg border border-border/30 bg-background/40 px-2 py-2">
                                        <div className="text-[9px] uppercase text-muted-foreground font-semibold">
                                          {t("routeManager.card.action", { ns: "game" })}
                                        </div>
                                        <div className="mt-1 font-bold text-foreground">
                                          {routeEconomics.recommendedAircraftCount < assignedCount
                                            ? t("routeManager.card.removeAircraft", {
                                                ns: "game",
                                                count:
                                                  assignedCount -
                                                  routeEconomics.recommendedAircraftCount,
                                              })
                                            : routeEconomics.recommendedAircraftCount >
                                                assignedCount
                                              ? t("routeManager.card.addAircraft", {
                                                  ns: "game",
                                                  count:
                                                    routeEconomics.recommendedAircraftCount -
                                                    assignedCount,
                                                })
                                              : t("routeManager.card.holdFleet", { ns: "game" })}
                                        </div>
                                        <div className="mt-1 text-[9px] text-muted-foreground">
                                          {t("routeManager.card.supportsAircraft", {
                                            ns: "game",
                                            count: routeEconomics.recommendedAircraftCount,
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Market Analysis Tab */}
                            <div className="mt-3 sm:mt-5 pt-3 sm:pt-5 border-t border-border/50">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                  <Globe className="h-3 w-3" />
                                  {t("routeManager.card.marketHealth", { ns: "game" })}
                                </h4>
                                <div className="flex gap-2">
                                  <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                                    <span className="text-[8px] text-muted-foreground font-bold uppercase">
                                      {t("routeManager.fareEditor.class.economy", { ns: "game" })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    <span className="text-[8px] text-muted-foreground font-bold uppercase">
                                      {t("routeManager.fareEditor.class.business", { ns: "game" })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                    <span className="text-[8px] text-muted-foreground font-bold uppercase">
                                      {t("routeManager.fareEditor.class.first", { ns: "game" })}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Demand class breakdown visualization */}
                              {(() => {
                                const demandTotal =
                                  demandSnapshot.totalDemand.economy +
                                  demandSnapshot.totalDemand.business +
                                  demandSnapshot.totalDemand.first;
                                return (
                                  <div className="flex h-1 w-full rounded-full bg-muted/30 overflow-hidden mb-3">
                                    <div
                                      className="h-full bg-zinc-500"
                                      style={{
                                        width:
                                          demandTotal === 0
                                            ? "0%"
                                            : `${(demandSnapshot.totalDemand.economy / demandTotal) * 100}%`,
                                      }}
                                    />
                                    <div
                                      className="h-full bg-blue-500"
                                      style={{
                                        width:
                                          demandTotal === 0
                                            ? "0%"
                                            : `${(demandSnapshot.totalDemand.business / demandTotal) * 100}%`,
                                      }}
                                    />
                                    <div
                                      className="h-full bg-yellow-500"
                                      style={{
                                        width:
                                          demandTotal === 0
                                            ? "0%"
                                            : `${(demandSnapshot.totalDemand.first / demandTotal) * 100}%`,
                                      }}
                                    />
                                  </div>
                                );
                              })()}

                              {(() => {
                                const routeKey = canonicalRouteKey(
                                  route.originIata,
                                  route.destinationIata,
                                );
                                const offers = globalRouteRegistry.get(routeKey) || [];

                                if (offers.length === 0) {
                                  return (
                                    <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                                      <p className="text-[11px] text-emerald-400/80 font-medium flex items-center gap-2">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {t("routeManager.card.noRivals", { ns: "game" })}
                                      </p>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="grid grid-cols-1 gap-2">
                                    {offers.map((offer: FlightOffer) => {
                                      const comp = competitors.get(offer.airlinePubkey);

                                      // Calculate estimated share for this offer vs ours
                                      const ourFrequency = computeRouteFrequency(
                                        route.distanceKm,
                                        route.assignedAircraftIds.length,
                                      );
                                      const ourTravelTime = Math.round(
                                        (route.distanceKm / 800) * 60,
                                      ); // simplified model speed

                                      const ourOffer: FlightOffer = {
                                        airlinePubkey: pubkey || "",
                                        fareEconomy: route.fareEconomy,
                                        fareBusiness: route.fareBusiness,
                                        fareFirst: route.fareFirst,
                                        frequencyPerWeek: ourFrequency || 1, // at least 1 for display
                                        travelTimeMinutes: ourTravelTime,
                                        stops: 0,
                                        serviceScore: 0.7,
                                        brandScore: airline.brandScore || 0.5,
                                      };

                                      const allOffers = [ourOffer, ...offers];
                                      const shares = calculateShares(allOffers);
                                      const compShare =
                                        (shares.economy.get(offer.airlinePubkey) || 0) * 100;

                                      return (
                                        <div
                                          key={`${offer.airlinePubkey}-${offer.frequencyPerWeek}-${offer.fareEconomy}`}
                                          className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 rounded-xl px-3 sm:px-4 py-2 border border-border/50"
                                        >
                                          <div className="flex items-center gap-3">
                                            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                              {comp?.icaoCode || "??"}
                                            </div>
                                            <div className="flex flex-col">
                                              <span className="text-xs font-bold text-foreground">
                                                {comp?.name ||
                                                  t("routeManager.card.unknownAirline", {
                                                    ns: "game",
                                                  })}
                                              </span>
                                              <span className="text-[9px] text-muted-foreground uppercase font-semibold">
                                                {t("routeManager.card.rivalFrequency", {
                                                  ns: "game",
                                                  value: offer.frequencyPerWeek,
                                                })}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex gap-4 items-center">
                                            <div className="flex gap-2">
                                              <span className="text-[10px] font-mono text-zinc-500">
                                                E: {fpFormat(offer.fareEconomy, 0)}
                                              </span>
                                              <span className="text-[10px] font-mono text-blue-400">
                                                B: {fpFormat(offer.fareBusiness, 0)}
                                              </span>
                                              <span className="text-[10px] font-mono text-yellow-500">
                                                F: {fpFormat(offer.fareFirst, 0)}
                                              </span>
                                            </div>
                                            <div className="h-8 w-px bg-border/50" />
                                            <div className="flex flex-col text-right">
                                              <span className="text-[9px] text-muted-foreground uppercase font-bold">
                                                {t("routeManager.card.estShare", { ns: "game" })}
                                              </span>
                                              <span className="text-xs font-bold text-accent">
                                                {compShare.toFixed(1)}%
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <OpportunitiesList
              markets={displayedOpportunities}
              activeRoutes={activeRoutes}
              isViewingOther={isViewingOther}
              canOpenFromOrigin={canOpenFromOrigin}
              originSlotControlled={originSlotControlled}
              searchQuery={searchQuery}
              searchResultCount={searchResults.length}
            />
          )}
        </div>
        {fareEditor && (
          <FareEditor
            key={fareEditor.routeId}
            target={fareEditor}
            onClose={() => setFareEditor(null)}
          />
        )}
        {assignRoute ? (
          <AssignAircraftDialog route={assignRoute} onClose={() => setAssignRouteId(null)} />
        ) : null}
      </div>
    </div>
  );
}
