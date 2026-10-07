import type { AircraftInstance, Route } from "@acars/core";
import { fpFormat, getProsperityIndex } from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWorldEventsBoard } from "@/features/events/useWorldEvents";
import { formatEventHours } from "@/features/events/worldEventsView";
import { useRelayHealth, type RelayStatus } from "@/shared/hooks/useRelayHealth";
import {
  cashResultSince,
  findNextLanding,
  formatCountdown,
  formatUtcClock,
  utcDayStartTick,
} from "../utils/tickerFacts";

const NO_FLEET: readonly AircraftInstance[] = [];
const NO_ROUTES: readonly Route[] = [];

const LIVE_STYLES: Record<RelayStatus, { text: string; dot: string; ping: boolean }> = {
  ready: { text: "text-primary", dot: "bg-primary", ping: true },
  connecting: { text: "text-amber-400", dot: "bg-amber-400", ping: false },
  offline: { text: "text-amber-400", dot: "bg-amber-400", ping: false },
};

/**
 * A global ticker component that displays live macroeconomic and network status.
 * Hidden on mobile devices to save screen space, visible on large screens.
 */
export function Ticker() {
  const { t } = useTranslation("game");
  const season = useEngineStore((s) => (s.routes.length > 0 ? s.routes[0]?.season : "winter"));
  const tick = useEngineStore((s) => s.tick);
  const homeAirport = useEngineStore((s) => s.homeAirport);
  const catchup = useEngineStore((s) => s.catchupProgress);

  // Fine-grained selectors — subscribing to the whole airline store made the
  // root-mounted Ticker re-render on every state write of any slice.
  const competitors = useAirlineStore((s) => s.competitors);
  const fleetByOwner = useAirlineStore((s) => s.fleetByOwner);
  const routesByOwner = useAirlineStore((s) => s.routesByOwner);

  // World totals derived once per fleet/routes reference (stable store refs)
  // instead of reducing the whole world on every render.
  const worldFleetCount = useMemo(() => {
    let total = 0;
    fleetByOwner.forEach((ownerFleet) => {
      total += ownerFleet.length;
    });
    return total;
  }, [fleetByOwner]);

  const worldRouteCount = useMemo(() => {
    let total = 0;
    routesByOwner.forEach((ownerRoutes) => {
      total += ownerRoutes.length;
    });
    return total;
  }, [routesByOwner]);

  // The player's own pulse. The cash selector returns a primitive, so timeline
  // writes only re-render the ticker when today's result actually changes.
  const hasAirline = useAirlineStore((s) => Boolean(s.airline));
  const fleet = useAirlineStore((s) => s.fleet ?? NO_FLEET);
  const dayStart = utcDayStartTick(tick);
  const cashToday = useAirlineStore((s) => cashResultSince(s.timeline, dayStart));
  const nextLanding = useMemo(() => findNextLanding(fleet, tick), [fleet, tick]);
  // The most relevant world event (S33): one touching the player first.
  const routes = useAirlineStore((s) => s.routes ?? NO_ROUTES);
  const topEvent = useWorldEventsBoard(routes).active[0];

  const { status: relayStatus } = useRelayHealth();
  const live = LIVE_STYLES[relayStatus];

  const prosperity = getProsperityIndex(tick);

  if (!homeAirport) return null;

  return (
    <div className="pointer-events-auto hidden sm:flex items-center space-x-6 whitespace-nowrap overflow-x-auto custom-scrollbar bg-background/95 backdrop-blur-sm border-t border-border px-4 py-1.5 text-xs font-mono text-muted-foreground z-50 fixed bottom-0 left-0 right-0 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
      <div
        className={`flex items-center space-x-2 w-24 shrink-0 ${live.text}`}
        data-testid="ticker-live"
        data-status={relayStatus}
      >
        <div
          className={`relative h-1.5 w-1.5 rounded-full shadow-[0_0_5px_currentColor] shrink-0 ${live.dot}`}
        >
          {live.ping && (
            <div className="absolute -inset-1 rounded-full bg-primary/20 animate-ping"></div>
          )}
        </div>
        <span className="font-semibold uppercase tracking-wider text-[10px]">
          {t(`ticker.relay.${relayStatus}`)}
        </span>
      </div>

      <div className="flex items-center space-x-2 border-r border-border pr-6 shrink-0">
        <span className="text-foreground font-semibold tabular-nums" data-testid="ticker-clock">
          {formatUtcClock(tick)}
        </span>
        <span className="text-[10px] text-muted-foreground/70">UTC</span>
      </div>

      {hasAirline && (
        <div
          className="flex items-center space-x-2 border-r border-border pr-6 shrink-0"
          data-testid="ticker-next-landing"
        >
          <span>{t("ticker.nextLanding")}</span>
          <span className="text-foreground font-semibold">
            {nextLanding
              ? t("ticker.nextLandingValue", {
                  iata: nextLanding.destinationIata,
                  time: formatCountdown(nextLanding.arrivalTick - tick),
                })
              : t("ticker.noLanding")}
          </span>
        </div>
      )}

      {hasAirline && (
        <div
          className="flex items-center space-x-2 border-r border-border pr-6 shrink-0"
          data-testid="ticker-cash-today"
        >
          <span>{t("ticker.cashToday")}</span>
          <span className={`font-semibold ${cashToday < 0 ? "text-red-400" : "text-green-500"}`}>
            {cashToday > 0 ? "+" : ""}
            {fpFormat(cashToday, 0)}
          </span>
        </div>
      )}

      {topEvent && (
        <div
          className="flex items-center space-x-2 border-r border-border pr-6 shrink-0"
          data-testid="ticker-world-event"
        >
          <span>{t("worldEvents.ticker")}</span>
          <span
            className={`font-semibold ${topEvent.yourRoutes.length > 0 ? "text-amber-400" : "text-foreground"}`}
          >
            {t("worldEvents.tickerValue", {
              kind: t(`worldEvents.kinds.${topEvent.event.kind}`),
              place: topEvent.event.airportIata ?? t("worldEvents.global"),
              time: formatEventHours(topEvent.ticksLeft),
            })}
          </span>
        </div>
      )}

      <div className="hidden sm:flex items-center space-x-2 border-r border-border pr-6">
        <span>{t("ticker.airlines")}</span>
        <span className="text-foreground font-bold">{1 + competitors.size}</span>
      </div>

      <div className="hidden sm:flex items-center space-x-2 border-r border-border pr-6">
        <span>{t("ticker.planes")}</span>
        <span className="text-foreground font-bold">{worldFleetCount}</span>
      </div>

      <div className="hidden sm:flex items-center space-x-2 border-r border-border pr-6">
        <span>{t("ticker.routes")}</span>
        <span className="text-foreground font-bold">{worldRouteCount}</span>
      </div>

      <div className="hidden md:flex items-center space-x-2 border-r border-border pr-6">
        <span>{t("ticker.season")}</span>
        <span className="text-info text-blue-400 capitalize">{t(`ticker.seasons.${season}`)}</span>
      </div>
      <div className="hidden md:flex items-center space-x-2 border-r border-border pr-6">
        <span>{t("ticker.economy")}</span>
        <span className={`font-semibold ${prosperity >= 1 ? "text-green-500" : "text-orange-400"}`}>
          {(prosperity * 100).toFixed(1)}%
        </span>
      </div>
      <div className="flex items-center space-x-2 shrink-0">
        <span>{t("ticker.status")}</span>
        {catchup ? (
          <span className="text-amber-400">
            {t("ticker.catchingUp", {
              phase: catchup.phase === "player" ? t("ticker.yourAirline") : t("ticker.world"),
              percent: Math.min(
                100,
                Math.round((catchup.current / Math.max(catchup.target, 1)) * 100),
              ),
            })}
          </span>
        ) : (
          <span className="text-green-500">{t("ticker.normalOperations")}</span>
        )}
      </div>
    </div>
  );
}
