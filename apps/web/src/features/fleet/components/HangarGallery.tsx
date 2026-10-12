import type { AircraftInstance, AirlineEntity, FixedPoint, Route } from "@acars/core";
import { fpFormat, TICKS_PER_HOUR } from "@acars/core";
import { getAircraftById } from "@acars/data";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteUtilization } from "@/features/network/hooks/useRouteUtilization";
import { usePanelScrollRef } from "@/shared/components/layout/panelScrollContext";
import { navigateToAircraft } from "@/shared/lib/permalinkNavigation";
import { legibleLiveryColour, modelLabel } from "@/shared/theme/livery";
import { clipDay, DayStrip } from "@/shared/ui/cockpit";
import { Sign, Slab } from "@/shared/ui/ramp";
import { type PlaneDay, summarizeFleetDays, topEarnerId } from "../utils/planeDay";
import { AircraftLiveryImage } from "./AircraftLiveryImage";
import { LiveryFallback } from "./LiveryFallback";

const ROW_HEIGHT = 336;
const TICKS_PER_MINUTE = TICKS_PER_HOUR / 60;

function useColumns(): number {
  const query = "(min-width: 640px)";
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setWide(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return wide ? 2 : 1;
}

/**
 * The hangar as a collection (S44, S60): every plane's painting on a slab
 * with its last 24 hours, its week's profit, the top earner signed and idle
 * planes one tap from work. Virtualized by row, so thousands stay cheap.
 */
export function HangarGallery({
  fleet,
  airline,
  routes,
}: {
  fleet: readonly AircraftInstance[];
  airline: AirlineEntity | null;
  routes: readonly Route[];
}) {
  const panelScrollRef = usePanelScrollRef();
  const listRef = useRef<HTMLDivElement>(null);
  const columns = useColumns();
  const rows = Math.ceil(fleet.length / columns);
  const routeById = useMemo(() => new Map(routes.map((route) => [route.id, route])), [routes]);
  const timeline = useAirlineStore((s) => s.timeline);
  const minuteTick = useEngineStore(
    (s) => Math.floor(s.tick / TICKS_PER_MINUTE) * TICKS_PER_MINUTE,
  );
  const days = useMemo(
    () => summarizeFleetDays(fleet, timeline, minuteTick),
    [fleet, timeline, minuteTick],
  );
  const topEarner = useMemo(() => topEarnerId(days), [days]);
  const legColour = legibleLiveryColour(airline?.livery?.primary, airline?.livery?.secondary);
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0);
  }, []);

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => panelScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    initialRect: { width: 1024, height: 1200 },
    overscan: 2,
    scrollMargin,
  });

  return (
    <div
      ref={listRef}
      data-testid="hangar-gallery"
      className="relative w-full"
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const start = row.index * columns;
        const items = fleet.slice(start, start + columns);
        return (
          <div
            key={row.key}
            className="absolute left-0 right-0 grid items-start gap-4"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              height: ROW_HEIGHT - 16,
              transform: `translateY(${row.start - scrollMargin}px)`,
            }}
          >
            {items.map((aircraft, i) => (
              <HangarCard
                key={aircraft.id}
                aircraft={aircraft}
                stand={start + i + 1}
                airline={airline}
                route={
                  aircraft.assignedRouteId ? routeById.get(aircraft.assignedRouteId) : undefined
                }
                day={days.get(aircraft.id)}
                isTopEarner={aircraft.id === topEarner}
                legColour={legColour}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function HangarCard({
  aircraft,
  stand,
  airline,
  route,
  day,
  isTopEarner,
  legColour,
}: {
  aircraft: AircraftInstance;
  stand: number;
  airline: AirlineEntity | null;
  route: Route | undefined;
  day: PlaneDay | undefined;
  isTopEarner: boolean;
  legColour: string;
}) {
  const { t } = useTranslation("game");
  const model = getAircraftById(aircraft.modelId);
  const utilization = useRouteUtilization(route);
  const legs = day?.legs ?? [];
  const blockHours = clipDay(legs).blockHours;
  const lineLegs = aircraft.line?.legs ?? [];
  const parked = !route && lineLegs.length === 0;
  const idle = parked || utilization.idle;
  const profit: FixedPoint | undefined = day?.profit7d;

  return (
    <Slab
      data-testid="hangar-tile"
      data-state={isTopEarner ? "top-earner" : idle ? "idle" : "normal"}
      edge={isTopEarner ? "sign" : idle ? "idle" : "none"}
      className="flex min-w-0 flex-col gap-2 p-3"
    >
      <button
        type="button"
        onClick={() => navigateToAircraft(aircraft.id)}
        className="group flex min-w-0 flex-col gap-2 text-left"
      >
        <div className="relative h-36 w-full overflow-hidden rounded-[2px]">
          {model ? (
            <AircraftLiveryImage
              aircraft={aircraft}
              airline={airline}
              model={model}
              isOwner
              fallback={
                <LiveryFallback
                  familyId={model.familyId}
                  primary={airline?.livery?.primary}
                  secondary={airline?.livery?.secondary}
                />
              }
            />
          ) : (
            <LiveryFallback familyId="a320" primary={airline?.livery?.primary} />
          )}
          <span className="absolute left-2 top-2 rounded-[2px] bg-sign-black px-1.5 py-0.5 font-mono text-[11px] font-bold text-sign-yellow">
            {t("fleet.hangar.stand", { stand })}
          </span>
          {isTopEarner ? (
            <Sign variant="location" className="absolute right-2 top-2 min-h-6 px-2 text-[11px]">
              {t("fleet.hangar.topEarner")}
            </Sign>
          ) : null}
        </div>
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="truncate font-sign text-lg font-extrabold uppercase tracking-[0.06em] text-ramp-paint group-hover:text-nd-cyan">
            {aircraft.name}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-ramp-paint/70">
            {model ? modelLabel(model.manufacturer, model.name) : aircraft.modelId}
          </span>
        </div>
      </button>

      <DayStrip
        legs={legs}
        colour={legColour}
        label={t("fleet.hangar.blockHours24", { hours: blockHours.toFixed(1) })}
      />

      <div className="flex min-w-0 items-center justify-between gap-2 font-mono text-xs">
        <span className={`truncate ${idle ? "text-nd-amber" : "text-ramp-paint/85"}`}>
          {route
            ? `${route.originIata} → ${route.destinationIata}`
            : lineLegs.length
              ? [lineLegs[0].originIata, ...lineLegs.map((leg) => leg.destinationIata)].join("→")
              : t("fleet.hangar.parked", { base: aircraft.baseAirportIata })}
        </span>
        <span className="shrink-0 text-ramp-paint/70">
          {t("fleet.hangar.blockHours24", { hours: blockHours.toFixed(1) })}
          {profit !== undefined && profit !== 0
            ? ` · ${t("fleet.hangar.profit7d", { profit: fpFormat(profit, 0) })}`
            : ""}
        </span>
      </div>

      {parked ? (
        <button
          type="button"
          data-testid="hangar-put-to-work"
          onClick={() => navigateToAircraft(aircraft.id)}
          className="min-h-9 rounded-[3px] bg-hi-vis px-3 font-sign text-xs font-extrabold uppercase tracking-[0.06em] text-sign-black"
        >
          {t("fleet.hangar.putToWork")}
        </button>
      ) : utilization.suggestedFrequency !== null && utilization.idle ? (
        <button
          type="button"
          data-testid="hangar-fly-more"
          disabled={utilization.saving}
          onClick={() => void utilization.flyMore()}
          className="min-h-9 rounded-[3px] bg-hi-vis px-3 font-sign text-xs font-extrabold uppercase tracking-[0.06em] text-sign-black disabled:opacity-60"
        >
          {t("routeManager.frequency.flyMore", { count: utilization.suggestedFrequency })}
        </button>
      ) : null}
    </Slab>
  );
}
