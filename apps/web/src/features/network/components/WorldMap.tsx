import type { AircraftInstance, Airport, Route } from "@acars/core";
import { TICK_DURATION } from "@acars/core";
import { getAirports } from "@acars/data";
import { useRoutePerformance } from "@/features/corporate/hooks/useRoutePerformance";
import { RouteLegend } from "@/features/network/components/RouteLegend";
import { useHubOpportunities } from "@/features/network/hooks/useHubOpportunities";
import type { HubOpportunity } from "@/features/network/utils/hubOpportunities";
import { useLandingBursts } from "@/features/network/hooks/useLandingBursts";
import { toMapRoutes } from "@/features/network/utils/mapRoutes";
import {
  DEFAULT_MAP_THEME,
  Globe as CoreGlobe,
  getGreatCircleInterpolation,
  type MapTheme,
} from "@acars/map";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { config as maplibreConfig } from "maplibre-gl";
// maplibre v6 resolves its worker at runtime from import.meta.url
// (`/assets/maplibre-gl-worker.mjs`), a file Vite never emits — the module
// worker 404s (text/html MIME error) and the canvas stays black while the
// HUD keeps living. The worker also imports `./maplibre-gl-shared.mjs`
// relative to its own URL, so both files must ship with their ORIGINAL
// names side by side: they are copied to public/maplibre/ (verbatim from
// maplibre-gl@6.9.0 dist) and WORKER_URL points at the stable copy.
maplibreConfig.WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
import { Moon, Sun, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { hasLeaderboardActivity } from "@/features/competition/leaderboardMetrics";
import { AircraftInfoPanel } from "@/features/network/components/AircraftInfoPanel";
import { AirportInfoPanel } from "@/features/network/components/AirportInfoPanel";
import { buildGroundPresenceByAirport } from "@/features/network/utils/groundTraffic";
import { MOBILE_BOTTOM_NAV_BOTTOM_CLASS } from "@/shared/components/layout/mobileLayout";
import {
  getDetailReturnTo,
  navigateToAircraft,
  navigateToAirport,
  navigateToPath,
} from "@/shared/lib/permalinkNavigation";

// Airport index built lazily on first use — the airports catalog loads async
// (after first paint), so module evaluation must not touch it.
let airportByIata: Map<string, Airport> | null = null;
function getAirportByIata(): Map<string, Airport> {
  if (!airportByIata) {
    airportByIata = new Map<string, Airport>(getAirports().map((a) => [a.iata, a]));
  }
  return airportByIata;
}
/** Stable lookup for hooks (the index itself is built lazily). */
const lookupAirport = (iata: string) => getAirportByIata().get(iata);
const MAP_THEME_STORAGE_KEY = "acars:map:theme";

const SHOW_WORLD_STORAGE_KEY = "acars_map_show_world";
const SHOW_OPPORTUNITIES_STORAGE_KEY = "acars_map_show_opportunities";
const NO_OPPORTUNITIES: HubOpportunity[] = [];

/** Per-viewer preference; off by default (it runs projections in a worker). */
function getSavedShowOpportunities(): boolean {
  try {
    return window.localStorage.getItem(SHOW_OPPORTUNITIES_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Per-viewer preference; storage can be unavailable (private mode), so default to the world. */
function getSavedShowWorld(): boolean {
  try {
    return window.localStorage.getItem(SHOW_WORLD_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function getSavedMapTheme(): MapTheme {
  if (typeof window === "undefined") return DEFAULT_MAP_THEME;
  const raw = window.localStorage.getItem(MAP_THEME_STORAGE_KEY);
  return raw === "light" || raw === "dark" ? raw : DEFAULT_MAP_THEME;
}

/**
 * Compute the best airport (or virtual focus point) for centering the map
 * on a given aircraft. For grounded aircraft, returns the base airport.
 * For enroute aircraft, returns a virtual Airport at the interpolated position.
 */
function getAircraftFocusPoint(
  ac: AircraftInstance,
  tick: number,
  tickProgress: number,
): Airport | null {
  if (ac.status === "enroute" && ac.flight) {
    const origin = getAirportByIata().get(ac.flight.originIata);
    const dest = getAirportByIata().get(ac.flight.destinationIata);
    if (origin && dest) {
      const elapsed = (tick - ac.flight.departureTick + tickProgress) * TICK_DURATION;
      const duration = (ac.flight.arrivalTick - ac.flight.departureTick) * TICK_DURATION;
      const progress = duration > 0 ? Math.max(0, Math.min(1, elapsed / duration)) : 0;
      const [lng, lat] = getGreatCircleInterpolation(
        [origin.longitude, origin.latitude],
        [dest.longitude, dest.latitude],
        progress,
      );
      // Return virtual airport at interpolated position
      return { ...dest, latitude: lat, longitude: lng };
    }
    return dest ?? null;
  }
  return ac.baseAirportIata ? (getAirportByIata().get(ac.baseAirportIata) ?? null) : null;
}

export function WorldMap() {
  const { t } = useTranslation("game");
  const homeAirport = useEngineStore((s) => s.homeAirport);
  const permalinkAirportIata = useEngineStore((s) => s.permalinkAirportIata);
  const permalinkAircraftId = useEngineStore((s) => s.permalinkAircraftId);
  // Live tick/progress for the globe's animation loop, kept OUTSIDE React:
  // subscribing re-rendered this root-mounted component every second for two
  // numbers that only the RAF loop reads. The globe reads the ref per frame.
  const engineClockRef = useRef({ tick: 0, tickProgress: 0 });
  useEffect(() => {
    const init = useEngineStore.getState();
    engineClockRef.current = { tick: init.tick, tickProgress: init.tickProgress };
    return useEngineStore.subscribe((state) => {
      engineClockRef.current = { tick: state.tick, tickProgress: state.tickProgress };
    });
  }, []);
  // Fine-grained selectors — the previous whole-store subscription re-rendered
  // the root-mounted map on every write of any airline-store slice.
  const airline = useAirlineStore((s) => s.airline);
  const fleet = useAirlineStore((s) => s.fleet);
  const fleetByOwner = useAirlineStore((s) => s.fleetByOwner);
  const routesByOwner = useAirlineStore((s) => s.routesByOwner);
  const competitors = useAirlineStore((s) => s.competitors);
  const routes = useAirlineStore((s) => s.routes);
  const timeline = useAirlineStore((s) => s.timeline);
  const landingBursts = useLandingBursts(lookupAirport);
  const routePerformance = useRoutePerformance(timeline, routes);
  // The player's routes styled by profit and frequency on the globe (S41).
  const playerRoutes = useMemo(
    () => toMapRoutes(routes, routePerformance),
    [routes, routePerformance],
  );
  const pubkey = useAirlineStore((s) => s.pubkey);
  const [inspectedAirport, setInspectedAirport] = useState<Airport | null>(null);
  const [inspectedAircraft, setInspectedAircraft] = useState<AircraftInstance | null>(null);
  const [focusedAirport, setFocusedAirport] = useState<Airport | null>(null);
  const [mapTheme, setMapTheme] = useState<MapTheme>(() => getSavedMapTheme());
  const [showWorld, setShowWorld] = useState<boolean>(() => getSavedShowWorld());
  useEffect(() => {
    try {
      window.localStorage.setItem(SHOW_WORLD_STORAGE_KEY, String(showWorld));
    } catch {
      // Preference only: ignore storage failures.
    }
  }, [showWorld]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MAP_THEME_STORAGE_KEY, mapTheme);
  }, [mapTheme]);

  // Permalink deep-link: when permalinkAirportIata is set (e.g. /airport/JFK),
  // automatically focus and inspect that airport on the map.
  useEffect(() => {
    if (!permalinkAirportIata) return;
    const airport = getAirportByIata().get(permalinkAirportIata);
    if (airport) {
      // Deferred to satisfy react-hooks/set-state-in-effect — this effect
      // synchronises external Zustand store state with local component state.
      queueMicrotask(() => {
        setFocusedAirport(airport);
        setInspectedAirport(airport);
        setInspectedAircraft(null);
      });
    }
  }, [permalinkAirportIata]);

  const competitorLiveries = useMemo(() => {
    const map = new Map<string, { primary: string; secondary: string }>();
    competitors.forEach((value, key) => {
      if (value.livery?.primary && value.livery?.secondary) {
        map.set(key, {
          primary: value.livery.primary,
          secondary: value.livery.secondary,
        });
      }
    });
    return map;
  }, [competitors]);

  const playerHubs = useMemo(() => airline?.hubs ?? [], [airline?.hubs]);
  const [showOpportunities, setShowOpportunities] = useState(getSavedShowOpportunities);
  const toggleOpportunities = () =>
    setShowOpportunities((current) => {
      try {
        window.localStorage.setItem(SHOW_OPPORTUNITIES_STORAGE_KEY, String(!current));
      } catch {
        // storage unavailable: the choice lasts for this visit
      }
      return !current;
    });
  // Opportunities from the hub you're looking at (if it's one of yours), else your main hub.
  const opportunityHub = !airline
    ? null
    : focusedAirport && playerHubs.includes(focusedAirport.iata)
      ? focusedAirport.iata
      : (playerHubs[0] ?? homeAirport?.iata ?? null);
  const hubOpportunities = useHubOpportunities(showOpportunities ? opportunityHub : null);
  const mapOpportunities =
    showOpportunities && hubOpportunities.opportunities
      ? hubOpportunities.opportunities
      : NO_OPPORTUNITIES;

  const competitorHubColors = useMemo(() => {
    const map = new Map<string, string>();
    competitors.forEach((value) => {
      if (!hasLeaderboardActivity(value) || !value.livery?.primary || !value.hubs?.length) return;
      for (const hubIata of value.hubs) {
        if (!map.has(hubIata)) {
          map.set(hubIata, value.livery.primary);
        }
      }
    });
    return map;
  }, [competitors]);

  const playerRouteDestinations = useMemo(() => {
    const destinations = new Set<string>();
    if (!playerHubs.length) return destinations;
    for (const route of routes) {
      if (route.status !== "active") continue;
      const originIsHub = playerHubs.includes(route.originIata);
      const destIsHub = playerHubs.includes(route.destinationIata);
      if (originIsHub && !destIsHub) destinations.add(route.destinationIata);
      if (destIsHub && !originIsHub) destinations.add(route.originIata);
    }
    return destinations;
  }, [playerHubs, routes]);

  const handleAirportSelect = (airport: Airport | null) => {
    if (!airport) return;
    setInspectedAirport(airport);
    setFocusedAirport(airport);
    setInspectedAircraft(null);
    navigateToAirport(airport.iata);
  };

  const clearAirportFocus = () => {
    setInspectedAirport(null);
    setFocusedAirport(null);
    navigateToPath(getDetailReturnTo(), { replace: true });
  };

  const competitorFleet = useMemo(() => {
    const playerPubkey = pubkey ?? null;
    const result: AircraftInstance[] = [];
    fleetByOwner.forEach((ownerFleet, key) => {
      if (key === playerPubkey) return;
      // Loop append instead of spread — `push(...ownerFleet)` throws
      // RangeError when an owner fleet exceeds the ~100k argument limit.
      for (const aircraft of ownerFleet) {
        result.push(aircraft);
      }
    });
    return result;
  }, [pubkey, fleetByOwner]);

  // Permalink deep-link: when permalinkAircraftId is set (e.g. /aircraft/abc123),
  // automatically inspect that aircraft on the map and center on its position.
  useEffect(() => {
    if (!permalinkAircraftId) return;
    const ac =
      fleet.find((a) => a.id === permalinkAircraftId) ??
      competitorFleet.find((a) => a.id === permalinkAircraftId) ??
      null;
    if (ac) {
      // Read tick imperatively to avoid re-running this effect every frame
      const { tick: t, tickProgress: tp } = useEngineStore.getState();
      // Deferred to satisfy react-hooks/set-state-in-effect
      queueMicrotask(() => {
        setInspectedAircraft(ac);
        setInspectedAirport(null);
        setFocusedAirport(getAircraftFocusPoint(ac, t, tp));
      });
    } else if (fleet.length > 0 || competitorFleet.length > 0) {
      // Fleet data loaded but aircraft not found — invalid ID, redirect home
      navigateToPath(getDetailReturnTo(), { replace: true });
    }
    // Re-run whenever fleet data updates (aircraft load asynchronously from Nostr)
  }, [permalinkAircraftId, fleet, competitorFleet]);

  const competitorRoutes = useMemo(() => {
    const playerPubkey = pubkey ?? null;
    const result: Route[] = [];
    routesByOwner.forEach((ownerRoutes, key) => {
      if (key === playerPubkey) return;
      // Loop append instead of spread (RangeError guard for huge owners).
      for (const route of ownerRoutes) {
        result.push(route);
      }
    });
    return result;
  }, [pubkey, routesByOwner]);

  const handleAircraftSelect = useCallback(
    (aircraftId: string) => {
      const ac =
        fleet.find((a) => a.id === aircraftId) ??
        competitorFleet.find((a) => a.id === aircraftId) ??
        null;
      if (!ac) return;
      // Read the clock imperatively: subscribing to tick/tickProgress made
      // this callback (and with it the whole map) churn every second.
      const { tick: t, tickProgress: tp } = useEngineStore.getState();
      setInspectedAircraft(ac);
      setInspectedAirport(null);
      setFocusedAirport(getAircraftFocusPoint(ac, t, tp));
      navigateToAircraft(aircraftId);
    },
    [fleet, competitorFleet],
  );

  const clearAircraftFocus = () => {
    setInspectedAircraft(null);
    setFocusedAirport(null);
    navigateToPath(getDetailReturnTo(), { replace: true });
  };

  const { presence: groundPresence } = useMemo(
    () => buildGroundPresenceByAirport(fleet, competitorFleet, airline ?? null, competitors),
    [fleet, competitorFleet, airline, competitors],
  );

  const handleMapClick = useCallback(() => {
    setInspectedAirport(null);
    setInspectedAircraft(null);
    setFocusedAirport(null);
    if (
      permalinkAirportIata ||
      permalinkAircraftId ||
      window.location.pathname.startsWith("/airport/") ||
      window.location.pathname.startsWith("/aircraft/")
    ) {
      navigateToPath(getDetailReturnTo(), { replace: true });
    }
  }, [permalinkAirportIata, permalinkAircraftId]);

  if (!homeAirport) return null;

  const selectedAirport = focusedAirport ?? homeAirport;
  const toggleThemeLabel =
    mapTheme === "dark"
      ? t("worldMap.switchToLightTheme", { ns: "game" })
      : t("worldMap.switchToDarkTheme", { ns: "game" });

  return (
    <div className="absolute inset-0 z-0 h-full w-full overflow-hidden bg-black">
      {/*
        ALTO 4 (map delivery): all data props handed to CoreGlobe are already
        reference-stable memos derived from store references (competitorFleet,
        competitorRoutes, groundPresence, competitorLiveries, playerHubs,
        competitorHubColors, playerRouteDestinations) and callbacks are
        useCallback-stable. Live tick/progress travel through engineClockRef
        (no re-render). Any further delivery optimization lives in
        packages/map/Globe.tsx, which is out of scope for apps/web.
      */}
      <CoreGlobe
        key={mapTheme}
        airports={getAirports()}
        selectedAirport={selectedAirport}
        onAirportSelect={handleAirportSelect}
        onAircraftSelect={handleAircraftSelect}
        onMapClick={handleMapClick}
        groundPresence={groundPresence}
        fleet={fleet}
        competitorFleet={competitorFleet}
        competitorRoutes={competitorRoutes}
        playerRoutes={playerRoutes}
        showWorld={showWorld}
        playerLivery={airline?.livery || null}
        competitorLiveries={competitorLiveries}
        playerHubs={playerHubs}
        competitorHubColors={competitorHubColors}
        playerRouteDestinations={playerRouteDestinations}
        engineClock={engineClockRef}
        bursts={landingBursts}
        opportunities={mapOpportunities}
        theme={mapTheme}
      />
      {playerRoutes.length > 0 ? (
        <RouteLegend showWorld={showWorld} onShowWorldChange={setShowWorld} />
      ) : null}
      {inspectedAirport ? (
        <AirportInfoPanel airport={inspectedAirport} onClose={clearAirportFocus} />
      ) : null}
      {inspectedAircraft ? (
        <AircraftInfoPanel aircraft={inspectedAircraft} onClose={clearAircraftFocus} />
      ) : null}
      {focusedAirport ? (
        <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          {t("worldMap.focus", { ns: "game", iata: focusedAirport.iata })}
        </div>
      ) : null}
      {showOpportunities && opportunityHub ? (
        <div
          // Left of the map buttons; above the route key when that one shows.
          className={`pointer-events-none absolute right-20 z-20 w-44 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-[10px] text-muted-foreground shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl ${MOBILE_BOTTOM_NAV_BOTTOM_CLASS} ${
            playerRoutes.length > 0 ? "sm:bottom-[11.25rem]" : "sm:bottom-14"
          }`}
          data-testid="opportunity-legend"
        >
          <p className="font-semibold uppercase tracking-widest text-foreground">
            {t("worldMap.opportunities.title", { ns: "game", iata: opportunityHub })}
          </p>
          <p className="mt-1">
            {hubOpportunities.pending && !hubOpportunities.opportunities
              ? t("worldMap.opportunities.computing", { ns: "game" })
              : hubOpportunities.opportunities?.length === 0
                ? t("worldMap.opportunities.empty", { ns: "game" })
                : t("worldMap.opportunities.key", { ns: "game" })}
          </p>
        </div>
      ) : null}
      <div
        className={`pointer-events-none absolute right-4 z-20 flex flex-col gap-2 ${MOBILE_BOTTOM_NAV_BOTTOM_CLASS} sm:bottom-14`}
      >
        {airline ? (
          <button
            type="button"
            onClick={toggleOpportunities}
            aria-pressed={showOpportunities}
            data-testid="opportunities-toggle"
            className={`pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border bg-background/80 shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
              showOpportunities
                ? "border-primary/60 text-primary"
                : "border-border/60 text-foreground"
            }`}
            title={t(
              showOpportunities ? "worldMap.opportunities.hide" : "worldMap.opportunities.show",
              {
                ns: "game",
              },
            )}
            aria-label={t(
              showOpportunities ? "worldMap.opportunities.hide" : "worldMap.opportunities.show",
              { ns: "game" },
            )}
          >
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() =>
            setMapTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))
          }
          className="pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          title={toggleThemeLabel}
          aria-label={toggleThemeLabel}
        >
          {mapTheme === "dark" ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {/* Map vignette overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_150px_rgba(0,0,0,0.9)]" />
    </div>
  );
}
