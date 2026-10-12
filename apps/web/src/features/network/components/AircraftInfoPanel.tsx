import type { AircraftInstance, Airport, Route, TimelineEvent } from "@acars/core";
import {
  calculateBookValue,
  computeRouteFrequency,
  FP_ZERO,
  fp,
  fpDiv,
  fpFormat,
  fpMul,
  fpSub,
  TICKS_PER_HOUR,
} from "@acars/core";
import { getAircraftById, getAirports } from "@acars/data";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Plane, Route as RouteIcon, Users, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PlaneAcars } from "@/features/fleet/components/AcarsFeed";
import { LineSection } from "@/features/fleet/components/LineSection";
import { NextDepartureBookingsCard } from "@/features/fleet/components/NextDepartureBookings";
import { AircraftLiveryImage } from "@/features/fleet/components/AircraftLiveryImage";
import { LastFlight } from "@/features/fleet/components/LastFlight";
import { LiveryFallback } from "@/features/fleet/components/LiveryFallback";
import { getAircraftTimer } from "@/features/fleet/utils/aircraftTimers";
import { EARTH_KM, planeLogbook } from "@/features/fleet/utils/logbook";
import { summarizeFleetDays } from "@/features/fleet/utils/planeDay";
import { AssignRouteDialog } from "@/features/network/components/AssignRouteDialog";
import { formatUtcClock } from "@/features/network/utils/tickerFacts";
import { LiveryThumb } from "@/shared/components/LiveryThumb";
import {
  MOBILE_BOTTOM_NAV_BOTTOM_CLASS,
  MOBILE_OVERLAY_MAX_HEIGHT_CLASS,
  MOBILE_TOPBAR_TOP_CLASS,
} from "@/shared/components/layout/mobileLayout";
import { navigateToAircraft, navigateToAirport } from "@/shared/lib/permalinkNavigation";
import { legibleLiveryColour, modelLabel } from "@/shared/theme/livery";
import { clipDay, type DayLeg, DayStrip, Readout } from "@/shared/ui/cockpit";
import { Sign } from "@/shared/ui/ramp";

type AircraftInfoPanelProps = {
  aircraft: AircraftInstance;
  onClose: () => void;
};

type AircraftSearchParams = {
  aircraftTab?: "info" | "route";
};

const numberFormat = new Intl.NumberFormat("en-US");
const TICKS_PER_MINUTE = TICKS_PER_HOUR / 60;
// Built lazily — the airports catalog loads async after first paint.
let airportIndex: Map<string, Airport> | null = null;
function getAirportIndex(): Map<string, Airport> {
  if (!airportIndex) {
    airportIndex = new Map(getAirports().map((a) => [a.iata, a]));
  }
  return airportIndex;
}

const statusConfig = {
  enroute: {
    labelKey: "aircraftPanel.status.enroute",
    className: "bg-sky-500/20 text-sky-200",
  },
  turnaround: {
    labelKey: "aircraftPanel.status.turnaround",
    className: "bg-amber-400/20 text-amber-200",
  },
  idle: {
    labelKey: "aircraftPanel.status.idle",
    className: "bg-emerald-500/20 text-emerald-200",
  },
  maintenance: {
    labelKey: "aircraftPanel.status.maintenance",
    className: "bg-rose-500/20 text-rose-200",
  },
  delivery: {
    labelKey: "aircraftPanel.status.delivery",
    className: "bg-blue-500/20 text-blue-200",
  },
} as const;

function ConditionBar({ condition }: { condition: number }) {
  const pct = Math.round(condition * 100);
  const color = pct >= 60 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-400" : "bg-rose-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-border/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono font-semibold text-foreground">{pct}%</span>
    </div>
  );
}

function findLatestAircraftLanding(
  timeline: readonly TimelineEvent[],
  aircraftId: string,
): TimelineEvent | null {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const event = timeline[index];
    if (event.type === "landing" && event.aircraftId === aircraftId) {
      return event;
    }
  }

  return null;
}

function SeatLayoutSection({ aircraft }: { aircraft: AircraftInstance }) {
  const { t } = useTranslation("game");
  const cabins = [
    {
      key: "economy",
      code: "Y",
      label: t("timeline.economy", { ns: "game" }),
      seats: aircraft.configuration.economy,
      barClassName: "bg-sky-400",
      tintClassName: "text-sky-200",
    },
    {
      key: "business",
      code: "J",
      label: t("timeline.business", { ns: "game" }),
      seats: aircraft.configuration.business,
      barClassName: "bg-violet-400",
      tintClassName: "text-violet-200",
    },
    {
      key: "first",
      code: "F",
      label: t("timeline.first", { ns: "game" }),
      seats: aircraft.configuration.first,
      barClassName: "bg-amber-400",
      tintClassName: "text-amber-200",
    },
  ].filter((cabin) => cabin.seats > 0);

  const totalSeats = cabins.reduce((sum, cabin) => sum + cabin.seats, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-semibold">
        <Users className="h-4 w-4" />
        {t("aircraftPanel.seatLayout", { ns: "game" })}
      </div>
      <div className="rounded-xl border border-border/60 bg-background/90 p-4 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {t("aircraftPanel.totalSeats", { ns: "game" })}
            </p>
            <p className="mt-1 text-lg font-mono font-semibold text-foreground">
              {numberFormat.format(totalSeats)}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground text-right">
            {aircraft.configuration.economy > 0 ? `Y${aircraft.configuration.economy}` : ""}
            {aircraft.configuration.business > 0 ? ` J${aircraft.configuration.business}` : ""}
            {aircraft.configuration.first > 0 ? ` F${aircraft.configuration.first}` : ""}
          </p>
        </div>

        <div className="space-y-2">
          {cabins.map((cabin) => {
            const share = totalSeats > 0 ? Math.round((cabin.seats / totalSeats) * 100) : 0;

            return (
              <div
                key={cabin.key}
                className="rounded-lg border border-border/40 bg-background/40 p-3"
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 font-mono font-bold ${cabin.tintClassName}`}
                    >
                      {cabin.code}
                    </span>
                    <span className="font-semibold text-foreground">{cabin.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold text-foreground">
                      {numberFormat.format(cabin.seats)}
                    </span>
                    <span className="ml-2 text-muted-foreground">{share}%</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-border/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${cabin.barClassName}`}
                    style={{ width: `${share}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RecentPerformanceSection({
  aircraft,
  model,
  lastLanding,
}: {
  aircraft: AircraftInstance;
  model: ReturnType<typeof getAircraftById> | null;
  lastLanding: TimelineEvent | null;
}) {
  const { t } = useTranslation("game");

  if (!lastLanding || !model) {
    return null;
  }

  const flightProfit = lastLanding.profit || FP_ZERO;
  const flightDurationTicks = lastLanding.details?.flightDurationTicks ?? 0;
  const isLeased = aircraft.purchaseType === "lease";
  const leaseForFlight = isLeased
    ? fpDiv(fpMul(model.monthlyLease, fp(flightDurationTicks)), fp(30 * 24 * TICKS_PER_HOUR))
    : FP_ZERO;
  const trueProfit = isLeased ? fpSub(flightProfit, leaseForFlight) : flightProfit;
  const isProfitable = trueProfit > 0;
  const pax = lastLanding.details?.passengers;
  const lf = lastLanding.details?.loadFactor;

  return (
    <div className="rounded-xl border border-border/60 bg-background/90 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
          {t("fleet.lastFlightOutcome", { ns: "game" })}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${isProfitable ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-red-500/20 bg-red-500/10 text-red-400"}`}
        >
          {isProfitable
            ? t("fleet.profitable", { ns: "game" })
            : t("fleet.lossMaking", { ns: "game" })}
        </span>
      </div>

      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            {t("fleet.route", { ns: "game" })}
          </span>
          <span className="text-xs font-bold text-foreground">
            <button
              type="button"
              onClick={() => lastLanding.originIata && navigateToAirport(lastLanding.originIata)}
              className="cursor-pointer transition-colors hover:text-primary"
            >
              {lastLanding.originIata ?? "—"}
            </button>
            {" → "}
            <button
              type="button"
              onClick={() =>
                lastLanding.destinationIata && navigateToAirport(lastLanding.destinationIata)
              }
              className="cursor-pointer transition-colors hover:text-primary"
            >
              {lastLanding.destinationIata ?? "—"}
            </button>
          </span>
        </div>

        <div className="min-w-0 flex flex-col text-right">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            {isLeased
              ? t("fleet.trueProfit", { ns: "game" })
              : t("fleet.netProfit", { ns: "game" })}
          </span>
          <span
            className={`text-sm font-mono font-bold ${isProfitable ? "text-emerald-400" : "text-red-400"}`}
          >
            {fpFormat(trueProfit, 0)}
          </span>
          {isLeased ? (
            <span className="text-[9px] font-mono text-muted-foreground/70">
              {t("fleet.leaseIncluded", {
                ns: "game",
                amount: fpFormat(leaseForFlight, 0),
              })}
            </span>
          ) : null}
        </div>
      </div>

      {pax && lf !== undefined ? (
        <div className="border-t border-border/30 pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              {t("flightBoard.loadFactor", { ns: "game" })}
            </span>
            <span
              className={`text-[10px] font-mono font-black ${
                lf >= 0.85 ? "text-emerald-400" : lf >= 0.6 ? "text-yellow-400" : "text-red-400"
              }`}
            >
              {Math.round(lf * 100)}%
            </span>
          </div>
          <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-muted/30">
            <div
              className={`h-full rounded-full transition-all ${
                lf >= 0.85 ? "bg-emerald-500" : lf >= 0.6 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.round(lf * 100)}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono">
            <span className="text-muted-foreground">
              <span className="font-bold text-foreground">{pax.total}</span>{" "}
              {t("fleet.passengersAbbr", { ns: "game" })}
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span className="text-muted-foreground">
              Y:<span className="font-bold text-foreground">{pax.economy}</span>
            </span>
            <span className="text-muted-foreground">
              J:
              <span className="font-bold text-foreground">{pax.business}</span>
            </span>
            <span className="text-muted-foreground">
              F:<span className="font-bold text-foreground">{pax.first}</span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** A live flight read like a flight tracker (S60): codes, UTC times, progress. */
function FlightStrip({
  aircraft,
  timer,
  speedKmh,
  distanceKm,
}: {
  aircraft: AircraftInstance;
  timer: ReturnType<typeof getAircraftTimer>;
  speedKmh: number;
  distanceKm?: number;
}) {
  const { t } = useTranslation("game");
  const flight = aircraft.flight;
  if (!flight || !timer) return null;

  const isFerry = flight.purpose === "ferry";
  const airports = getAirportIndex();
  const progress = Math.round(timer.progress * 100);
  const kmLeft = distanceKm ? Math.round(distanceKm * (1 - timer.progress)) : null;
  const end = (iata: string, label: string, time: string, align: "left" | "right") => (
    <div className={`flex min-w-0 flex-col ${align === "right" ? "items-end text-right" : ""}`}>
      <button
        type="button"
        className="font-sign text-3xl font-extrabold leading-none tracking-[0.04em] text-nd-white hover:text-nd-cyan"
        onClick={() => navigateToAirport(iata)}
      >
        {iata}
      </button>
      <span className="mt-1 max-w-full truncate text-xs text-muted-foreground">
        {airports.get(iata)?.city ?? iata}
      </span>
      <span className="mt-1 font-mono text-xs text-nd-white">
        <span className="text-muted-foreground">{label}</span> {time}Z
      </span>
    </div>
  );

  return (
    <div
      data-testid="flight-strip"
      className="space-y-3 rounded-[3px] border border-cockpit-line bg-cockpit-bg p-4"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        {end(
          flight.originIata,
          t("aircraftPanel.std"),
          formatUtcClock(flight.departureTick),
          "left",
        )}
        <div className="flex flex-col items-center pt-2 text-nd-magenta">
          <Plane className="h-4 w-4" aria-hidden="true" />
          {isFerry ? (
            <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-nd-amber">
              {t("aircraftPanel.ferry")}
            </span>
          ) : null}
        </div>
        {end(
          flight.destinationIata,
          t("aircraftPanel.eta"),
          formatUtcClock(flight.arrivalTick),
          "right",
        )}
      </div>

      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("aircraftPanel.flightProgress")}
        className="h-1.5 overflow-hidden rounded-[2px] bg-cockpit-line"
      >
        <div className="h-full bg-nd-magenta" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Readout
          label={t("aircraftPanel.groundSpeed")}
          value={numberFormat.format(speedKmh)}
          unit="km/h"
        />
        {kmLeft !== null ? (
          <Readout label={t("aircraftPanel.toGo")} value={numberFormat.format(kmLeft)} unit="km" />
        ) : null}
        <Readout label={t("aircraftPanel.timeLeft")} value={timer.time} tone="selected" />
      </div>
    </div>
  );
}

/** What the plane has done (S61): lifetime hours, the recent log, its passport. */
function LogbookSection({
  aircraft,
  timeline,
}: {
  aircraft: AircraftInstance;
  timeline: readonly TimelineEvent[];
}) {
  const { t } = useTranslation("game");
  const log = useMemo(
    () =>
      planeLogbook(aircraft.id, timeline, (iata) => {
        const airport = getAirportIndex().get(iata);
        return airport ? { latitude: airport.latitude, longitude: airport.longitude } : undefined;
      }),
    [aircraft.id, timeline],
  );
  const laps = log.distanceKm / EARTH_KM;
  return (
    <section data-testid="logbook" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t("aircraftPanel.logbook.title")}
        </h4>
        {log.sinceTick !== null ? (
          <span className="text-[10px] text-muted-foreground">
            {t("aircraftPanel.logbook.recent", { count: log.landings })}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Readout
          label={t("aircraftPanel.logbook.hours")}
          value={numberFormat.format(Math.round(aircraft.flightHoursTotal))}
          unit="h"
        />
        <Readout
          label={t("aircraftPanel.logbook.landings")}
          value={numberFormat.format(log.landings)}
        />
        <Readout
          label={t("aircraftPanel.logbook.passengers")}
          value={numberFormat.format(log.passengers)}
        />
        <Readout
          label={t("aircraftPanel.logbook.distance")}
          value={numberFormat.format(log.distanceKm)}
          unit="km"
        />
        <Readout
          label={t("aircraftPanel.logbook.earned")}
          value={fpFormat(log.profit, 0)}
          tone={log.profit > 0 ? "normal" : log.profit < 0 ? "warning" : "data"}
        />
      </div>
      {laps >= 0.05 ? (
        <p className="text-xs text-muted-foreground">
          {t("aircraftPanel.logbook.laps", { laps: laps.toFixed(laps < 10 ? 1 : 0) })}
        </p>
      ) : null}
      {log.airports.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label={t("aircraftPanel.logbook.passport")}>
          {log.airports.slice(0, 12).map((iata, index) => (
            <span
              key={iata}
              data-testid="passport-stamp"
              className="rounded-[3px] border-2 border-dashed border-nd-magenta/70 px-2 py-0.5 font-sign text-sm font-extrabold tracking-[0.08em] text-nd-magenta"
              style={{ transform: `rotate(${((index * 37) % 11) - 5}deg)` }}
            >
              {iata}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("aircraftPanel.logbook.empty")}</p>
      )}
    </section>
  );
}

/** The plane's day so far as a strip of legs in its airline's colour (S60). */
function TodayStrip({ legs, colour }: { legs: DayLeg[]; colour?: string }) {
  const { t } = useTranslation("game");
  const hours = clipDay(legs).blockHours;
  return (
    <div data-testid="today-strip" className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <span>{t("aircraftPanel.today")}</span>
        <span className="font-mono normal-case tracking-normal text-nd-white">
          {t("aircraftPanel.blockHoursToday", { hours: hours.toFixed(1) })}
        </span>
      </div>
      <DayStrip
        legs={legs}
        colour={colour}
        label={t("aircraftPanel.blockHoursToday", { hours: hours.toFixed(1) })}
      />
    </div>
  );
}

export function AircraftInfoPanel({ aircraft, onClose }: AircraftInfoPanelProps) {
  const { t } = useTranslation(["common", "game"]);
  const navigate = useNavigate();
  const search = useSearch({ from: "__root__" });
  // Fine-grained selectors — the previous whole-store subscription re-rendered
  // this panel on every write of any airline-store slice.
  const airline = useAirlineStore((s) => s.airline);
  const fleet = useAirlineStore((s) => s.fleet);
  const routesByOwner = useAirlineStore((s) => s.routesByOwner);
  const competitors = useAirlineStore((s) => s.competitors);
  const timeline = useAirlineStore((s) => s.timeline);
  const tick = useEngineStore((s) => s.tick);
  const tickProgress = useEngineStore((s) => s.tickProgress);

  const activeTab = search.aircraftTab === "route" ? "route" : "info";

  const setActiveTab = useCallback(
    (newTab: "info" | "route") => {
      navigate({
        to: window.location.pathname,
        search: (prev: AircraftSearchParams) => ({
          ...prev,
          aircraftTab: newTab === "info" ? undefined : newTab,
        }),
      });
    },
    [navigate],
  );

  useEffect(() => {
    let armed = false;
    const timer = setTimeout(() => {
      armed = true;
    }, 300);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && armed) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!search.aircraftTab) {
      setActiveTab("info");
    }
  }, [search.aircraftTab, setActiveTab]);

  const model = getAircraftById(aircraft.modelId);
  const timer = getAircraftTimer(aircraft, tick, tickProgress);

  const bookValue = useMemo(() => {
    if (!model) return null;
    return calculateBookValue(
      model,
      aircraft.flightHoursTotal,
      aircraft.condition,
      aircraft.birthTick || aircraft.purchasedAtTick,
      tick,
    );
  }, [
    model,
    aircraft.flightHoursTotal,
    aircraft.condition,
    aircraft.birthTick,
    aircraft.purchasedAtTick,
    tick,
  ]);

  const isPlayerAircraft = airline?.ceoPubkey === aircraft.ownerPubkey;
  const [assigningRoute, setAssigningRoute] = useState(false);

  const ownerAirline = useMemo(() => {
    if (isPlayerAircraft) return airline;
    return competitors.get(aircraft.ownerPubkey) ?? null;
  }, [isPlayerAircraft, airline, competitors, aircraft.ownerPubkey]);

  const assignedRoute = useMemo((): Route | null => {
    if (!aircraft.assignedRouteId) return null;
    // Direct bucket lookup via owner pubkey when available
    const ownerRoutes = aircraft.ownerPubkey ? routesByOwner.get(aircraft.ownerPubkey) : undefined;
    if (ownerRoutes) {
      const match = ownerRoutes.find((r) => r.id === aircraft.assignedRouteId);
      if (match) return match;
    }
    // Fallback: scan all owners (e.g. if ownerPubkey is missing)
    for (const bucket of routesByOwner.values()) {
      if (bucket === ownerRoutes) continue; // already checked
      const match = bucket.find((r) => r.id === aircraft.assignedRouteId);
      if (match) return match;
    }
    return null;
  }, [aircraft.assignedRouteId, aircraft.ownerPubkey, routesByOwner]);

  const siblingsOnRoute = useMemo(() => {
    if (!assignedRoute || !isPlayerAircraft) return [];
    return fleet.filter((ac) => ac.assignedRouteId === assignedRoute.id && ac.id !== aircraft.id);
  }, [assignedRoute, fleet, isPlayerAircraft, aircraft.id]);

  const status = statusConfig[aircraft.status];
  const familyId = model?.familyId ?? "a320";
  // The strip moves by minutes; no need to re-scan the timeline every tick.
  const minuteTick = Math.floor(tick / TICKS_PER_MINUTE) * TICKS_PER_MINUTE;
  const todayLegs = useMemo(
    () => summarizeFleetDays([aircraft], timeline, minuteTick).get(aircraft.id)?.legs ?? [],
    [aircraft, timeline, minuteTick],
  );
  const lastLanding = useMemo(
    () => findLatestAircraftLanding(timeline, aircraft.id),
    [timeline, aircraft.id],
  );

  return (
    <aside
      className={`pointer-events-auto fixed z-30 flex max-h-none flex-col overflow-hidden rounded-[24px] border border-border/80 bg-background sm:bg-background/96 shadow-[0_26px_80px_rgba(0,0,0,0.68)] left-3 right-3 ${MOBILE_TOPBAR_TOP_CLASS} ${MOBILE_BOTTOM_NAV_BOTTOM_CLASS} ${MOBILE_OVERLAY_MAX_HEIGHT_CLASS} sm:left-auto sm:right-4 sm:top-[calc(var(--hud-top,7rem)+0.75rem)] sm:bottom-14 sm:w-[min(480px,calc(100vw-2rem))] sm:max-h-none sm:rounded-[26px]`}
      aria-live="polite"
    >
      {/* Hero (S60): the painting first, the plane's name on a sign over it. */}
      <div
        data-testid="aircraft-hero"
        className="relative aspect-[16/9] max-h-[38vh] w-full shrink-0 overflow-hidden border-b border-border/60 bg-cockpit-panel sm:max-h-none"
      >
        {model ? (
          <AircraftLiveryImage
            aircraft={aircraft}
            airline={ownerAirline}
            model={model}
            isOwner={isPlayerAircraft}
            fallback={
              <LiveryFallback
                familyId={familyId}
                primary={ownerAirline?.livery?.primary}
                secondary={ownerAirline?.livery?.secondary}
              />
            }
          />
        ) : (
          <LiveryFallback familyId={familyId} primary={ownerAirline?.livery?.primary} />
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-nd-white transition-colors hover:bg-black/90 touch-manipulation"
          aria-label={t("aircraftPanel.closeAria", { ns: "game" })}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="absolute bottom-3 left-3 right-14 flex flex-col items-start gap-1">
          <h3 className="min-w-0 max-w-full">
            <Sign variant="location" className="max-w-full text-base sm:text-lg">
              <span className="block truncate">{aircraft.name}</span>
            </Sign>
          </h3>
          <span className="flex max-w-full items-center gap-1.5 truncate rounded-[2px] bg-black/70 px-2 py-0.5 text-xs text-nd-white">
            {model ? modelLabel(model.manufacturer, model.name) : aircraft.modelId}
            {ownerAirline ? (
              <>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ownerAirline.livery?.primary ?? "#94a3b8" }}
                  aria-hidden="true"
                />
                {ownerAirline.name}
                {ownerAirline.icaoCode ? ` (${ownerAirline.icaoCode})` : ""}
              </>
            ) : null}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-5 sm:px-5">
        {/* Live flight strip */}
        {aircraft.status === "enroute" && model ? (
          <FlightStrip
            aircraft={aircraft}
            timer={timer}
            speedKmh={model.speedKmh}
            distanceKm={aircraft.flight?.distanceKm ?? assignedRoute?.distanceKm}
          />
        ) : null}

        {/* Timer for non-enroute states */}
        {timer && aircraft.status !== "enroute" ? (
          <div className="rounded-xl border border-border/60 bg-background/90 p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{timer.label}</span>
            <span className="font-mono text-sm font-semibold text-foreground">{timer.time}</span>
          </div>
        ) : null}

        {isPlayerAircraft ? (
          <TodayStrip
            legs={todayLegs}
            colour={legibleLiveryColour(
              ownerAirline?.livery?.primary,
              ownerAirline?.livery?.secondary,
            )}
          />
        ) : null}

        {/* Status badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-widest font-semibold ${status.className}`}
          >
            {t(status.labelKey, { ns: "game" })}
          </span>
          {model ? (
            <span className="rounded-full border border-border/60 bg-background/90 px-2.5 py-1 text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
              {model.type}
            </span>
          ) : null}
          <span className="rounded-full border border-border/60 bg-background/90 px-2.5 py-1 text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
            {aircraft.purchaseType === "lease"
              ? t("aircraftPanel.leased", { ns: "game" })
              : t("aircraftPanel.owned", { ns: "game" })}
          </span>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 rounded-full border border-border/60 bg-background/90 p-1 text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
          {(
            [
              { key: "info", label: t("nav.info", { ns: "common" }) },
              {
                key: "route",
                label: t("aircraftPanel.routeTab", { ns: "game" }),
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? "flex-1 rounded-full bg-foreground/10 px-3 py-1 text-foreground"
                  : "flex-1 rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "info" ? (
          <>
            {isPlayerAircraft ? <LineSection aircraft={aircraft} /> : null}
            {isPlayerAircraft ? <NextDepartureBookingsCard aircraft={aircraft} /> : null}
            {isPlayerAircraft ? <LogbookSection aircraft={aircraft} timeline={timeline} /> : null}
            {isPlayerAircraft && lastLanding ? (
              <LastFlight aircraft={aircraft} landing={lastLanding} />
            ) : null}
            {isPlayerAircraft ? <PlaneAcars aircraftId={aircraft.id} /> : null}

            {/* Specs grid */}
            {model ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {t("aircraft.range", { ns: "game" })}
                  </p>
                  <p className="mt-1 text-sm font-mono font-semibold">
                    {numberFormat.format(model.rangeKm)} km
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {t("aircraft.speed", { ns: "game" })}
                  </p>
                  <p className="mt-1 text-sm font-mono font-semibold">
                    {numberFormat.format(model.speedKmh)} km/h
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {t("aircraft.capacity", { ns: "game" })}
                  </p>
                  <p className="mt-1 text-sm font-mono font-semibold">
                    {aircraft.configuration.economy > 0 ? `Y${aircraft.configuration.economy}` : ""}
                    {aircraft.configuration.business > 0
                      ? ` J${aircraft.configuration.business}`
                      : ""}
                    {aircraft.configuration.first > 0 ? ` F${aircraft.configuration.first}` : ""}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {t("aircraft.fuelBurn", { ns: "game" })}
                  </p>
                  <p className="mt-1 text-sm font-mono font-semibold">
                    {numberFormat.format(model.fuelBurnKgPerHour)} kg/h
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {t("aircraftPanel.mtow", { ns: "game" })}
                  </p>
                  <p className="mt-1 text-sm font-mono font-semibold">
                    {numberFormat.format(model.maxTakeoffWeight)} kg
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {t("aircraftPanel.wingspan", { ns: "game" })}
                  </p>
                  <p className="mt-1 text-sm font-mono font-semibold">{model.wingspanM} m</p>
                </div>
              </div>
            ) : null}

            <SeatLayoutSection aircraft={aircraft} />

            {/* Condition & maintenance */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                <Wrench className="h-4 w-4" />
                {t("aircraftPanel.conditionAndMaintenance", { ns: "game" })}
              </div>
              <div className="rounded-xl border border-border/60 bg-background/90 p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{t("aircraftPanel.airframeCondition", { ns: "game" })}</span>
                  </div>
                  <ConditionBar condition={aircraft.condition} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {t("aircraftPanel.totalHours", { ns: "game" })}
                    </p>
                    <p className="mt-0.5 text-sm font-mono font-semibold">
                      {numberFormat.format(Math.round(aircraft.flightHoursTotal))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {t("aircraftPanel.sinceCheck", { ns: "game" })}
                    </p>
                    <p className="mt-0.5 text-sm font-mono font-semibold">
                      {t("units.hours", {
                        ns: "common",
                        value: numberFormat.format(Math.round(aircraft.flightHoursSinceCheck)),
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Economics */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                <Plane className="h-4 w-4" />
                {t("aircraftPanel.economics", { ns: "game" })}
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-border/60 bg-background/88 p-4 sm:p-5">
                <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {t("aircraftPanel.purchasePrice", { ns: "game" })}
                  </p>
                  <p className="mt-1 text-sm font-mono font-semibold">
                    {fpFormat(aircraft.purchasePrice, 0)}
                  </p>
                </div>
                {bookValue !== null ? (
                  <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {t("fleet.appraisal", { ns: "game" })}
                    </p>
                    <p className="mt-1 text-sm font-mono font-semibold">{fpFormat(bookValue, 0)}</p>
                  </div>
                ) : null}
                {model ? (
                  <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {t("aircraftPanel.casm", { ns: "game" })}
                    </p>
                    <p className="mt-1 text-sm font-mono font-semibold">
                      {fpFormat(model.casm, 4)}
                    </p>
                  </div>
                ) : null}
                {model ? (
                  <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {t("aircraftPanel.maintPerHour", { ns: "game" })}
                    </p>
                    <p className="mt-1 text-sm font-mono font-semibold">
                      {fpFormat(model.maintCostPerHour, 0)}
                    </p>
                  </div>
                ) : null}
                {aircraft.purchaseType === "lease" && model ? (
                  <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {t("aircraftPanel.monthlyLease", { ns: "game" })}
                    </p>
                    <p className="mt-1 text-sm font-mono font-semibold">
                      {fpFormat(model.monthlyLease, 0)}
                    </p>
                  </div>
                ) : null}
                {aircraft.lastKnownLoadFactor !== undefined ? (
                  <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {t("aircraftPanel.lastLoadFactor", { ns: "game" })}
                    </p>
                    <p className="mt-1 text-sm font-mono font-semibold">
                      {Math.round(aircraft.lastKnownLoadFactor * 100)}%
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Base & assignment */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                <RouteIcon className="h-4 w-4" />
                {t("aircraftPanel.assignment", { ns: "game" })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {t("aircraftPanel.base", { ns: "game" })}
                  </p>
                  <p className="mt-1 text-sm font-mono font-semibold">
                    {aircraft.baseAirportIata ? (
                      <button
                        type="button"
                        onClick={() => navigateToAirport(aircraft.baseAirportIata)}
                        className="hover:text-primary transition-colors cursor-pointer"
                      >
                        {aircraft.baseAirportIata}
                      </button>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/90 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {t("fleet.route", { ns: "game" })}
                  </p>
                  <p className="mt-1 text-sm font-mono font-semibold">
                    {assignedRoute ? (
                      <>
                        <button
                          type="button"
                          onClick={() => navigateToAirport(assignedRoute.originIata)}
                          className="hover:text-primary transition-colors cursor-pointer"
                        >
                          {assignedRoute.originIata}
                        </button>
                        {" — "}
                        <button
                          type="button"
                          onClick={() => navigateToAirport(assignedRoute.destinationIata)}
                          className="hover:text-primary transition-colors cursor-pointer"
                        >
                          {assignedRoute.destinationIata}
                        </button>
                      </>
                    ) : (
                      t("fleet.unassigned", { ns: "game" })
                    )}
                  </p>
                </div>
              </div>
              {isPlayerAircraft ? (
                <button
                  type="button"
                  data-testid="aircraft-assign-route"
                  onClick={() => setAssigningRoute(true)}
                  className={
                    assignedRoute
                      ? "w-full rounded-xl border border-border/60 px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-accent hover:text-foreground"
                      : "w-full rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                  }
                >
                  {assignedRoute
                    ? t("assign.changeRoute", { ns: "game" })
                    : t("assign.assignRoute", { ns: "game" })}
                </button>
              ) : null}
            </div>
          </>
        ) : (
          /* Route tab */
          <RouteTab
            route={assignedRoute}
            siblings={siblingsOnRoute}
            aircraft={aircraft}
            lastLanding={lastLanding}
            model={model}
            onAssign={isPlayerAircraft ? () => setAssigningRoute(true) : undefined}
          />
        )}
      </div>
      {assigningRoute ? (
        <AssignRouteDialog aircraft={aircraft} onClose={() => setAssigningRoute(false)} />
      ) : null}
    </aside>
  );
}

export function RouteTab({
  route,
  siblings,
  aircraft,
  lastLanding,
  model,
  onAssign,
}: {
  route: Route | null;
  siblings: AircraftInstance[];
  aircraft: AircraftInstance;
  lastLanding: TimelineEvent | null;
  model: ReturnType<typeof getAircraftById> | null;
  /** Owner only: opens the assign-route dialog from the empty state. */
  onAssign?: () => void;
}) {
  const { t, i18n } = useTranslation(["common", "game"]);
  const regionNames = useMemo(
    () =>
      new Intl.DisplayNames([i18n.resolvedLanguage || i18n.language || "en"], {
        type: "region",
      }),
    [i18n.resolvedLanguage, i18n.language],
  );

  if (!route) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <RouteIcon className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm font-semibold">
          {t("aircraftPanel.noRouteAssigned", { ns: "game" })}
        </p>
        <p className="text-xs mt-1">
          {t("aircraftPanel.noRouteAssignedDescription", { ns: "game" })}
        </p>
        {onAssign ? (
          <button
            type="button"
            onClick={onAssign}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            {t("assign.assignRoute", { ns: "game" })}
          </button>
        ) : null}
      </div>
    );
  }

  const originAirport = getAirportIndex().get(route.originIata);
  const destAirport = getAirportIndex().get(route.destinationIata);
  const acModel = getAircraftById(aircraft.modelId);
  const frequency = computeRouteFrequency(
    route.distanceKm,
    route.assignedAircraftIds.length,
    acModel?.speedKmh || 800,
    acModel?.turnaroundTimeMinutes || 35,
    acModel?.blockHoursPerDay || 16,
  );

  const getLocalTime = (tz: string | undefined) => {
    if (!tz) return null;
    try {
      return new Date().toLocaleTimeString(i18n.resolvedLanguage || i18n.language || "en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  };

  const getCountryName = (code: string | undefined) => {
    if (!code) return null;
    try {
      return regionNames.of(code) ?? code;
    } catch {
      return code;
    }
  };

  return (
    <div className="space-y-5">
      {/* Route header */}
      <div className="rounded-xl border border-border/60 bg-background/90 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-center min-w-0">
              <button
                type="button"
                className="text-lg font-mono font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                onClick={() => navigateToAirport(route.originIata)}
              >
                {route.originIata}
              </button>
              {originAirport ? (
                <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                  {originAirport.city}, {getCountryName(originAirport.country)}
                </p>
              ) : null}
              {originAirport?.timezone ? (
                <p className="text-[10px] font-mono text-muted-foreground/70">
                  {getLocalTime(originAirport.timezone)}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground shrink-0">
              <div className="h-px w-4 bg-border" />
              <Plane className="h-3 w-3" />
              <div className="h-px w-4 bg-border" />
            </div>
            <div className="text-center min-w-0">
              <button
                type="button"
                className="text-lg font-mono font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                onClick={() => navigateToAirport(route.destinationIata)}
              >
                {route.destinationIata}
              </button>
              {destAirport ? (
                <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                  {destAirport.city}, {getCountryName(destAirport.country)}
                </p>
              ) : null}
              {destAirport?.timezone ? (
                <p className="text-[10px] font-mono text-muted-foreground/70">
                  {getLocalTime(destAirport.timezone)}
                </p>
              ) : null}
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest font-semibold ${
              route.status === "active"
                ? "bg-emerald-500/20 text-emerald-200"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t(`aircraftPanel.routeStatus.${route.status}`, {
              ns: "game",
              defaultValue: route.status,
            })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {t("aircraftPanel.distance", { ns: "game" })}
            </p>
            <p className="mt-0.5 text-sm font-mono font-semibold">
              {numberFormat.format(route.distanceKm)} km
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {t("aircraftPanel.frequency", { ns: "game" })}
            </p>
            <p className="mt-0.5 text-sm font-mono font-semibold">
              {t("units.timesPerWeek", { ns: "common", value: frequency })}
            </p>
          </div>
        </div>
      </div>

      {lastLanding && model ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            {t("aircraftPanel.recentPerformance", { ns: "game" })}
          </p>
          <RecentPerformanceSection aircraft={aircraft} model={model} lastLanding={lastLanding} />
        </div>
      ) : null}

      {/* Fares */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          {t("aircraftPanel.fares", { ns: "game" })}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/60 bg-background/90 p-3 text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {t("timeline.economy", { ns: "game" })}
            </p>
            <p className="mt-1 text-sm font-mono font-semibold">{fpFormat(route.fareEconomy, 0)}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/90 p-3 text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {t("timeline.business", { ns: "game" })}
            </p>
            <p className="mt-1 text-sm font-mono font-semibold">
              {fpFormat(route.fareBusiness, 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/90 p-3 text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {t("timeline.first", { ns: "game" })}
            </p>
            <p className="mt-1 text-sm font-mono font-semibold">{fpFormat(route.fareFirst, 0)}</p>
          </div>
        </div>
      </div>

      {/* Siblings on same route */}
      {siblings.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            {t("aircraftPanel.otherAircraftOnRoute", { ns: "game" })}
          </p>
          <div className="space-y-1.5">
            {siblings.slice(0, 5).map((ac) => {
              const acModel = getAircraftById(ac.modelId);
              return (
                <button
                  type="button"
                  key={ac.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-xs hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => navigateToAircraft(ac.id)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <LiveryThumb
                      imageUrl={ac.liveryImageUrl}
                      familyId={acModel?.familyId}
                      alt={ac.name}
                      size="xs"
                    />
                    <span className="truncate font-semibold text-foreground">{ac.name}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {acModel ? `${acModel.manufacturer} ${acModel.name}` : ac.modelId}
                  </span>
                </button>
              );
            })}
            {siblings.length > 5 ? (
              <p className="text-[11px] text-muted-foreground px-1">
                {t("aircraftPanel.more", {
                  ns: "game",
                  count: siblings.length - 5,
                })}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
