import type { AircraftInstance, AirlineEntity, Route } from "@acars/core";
import { getAircraftById } from "@acars/data";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePanelScrollRef } from "@/shared/components/layout/panelScrollContext";
import { LiveryThumb } from "@/shared/components/LiveryThumb";
import { navigateToAircraft } from "@/shared/lib/permalinkNavigation";

const ROW_HEIGHT = 196;

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
  return wide ? 3 : 2;
}

/**
 * Hangar gallery (S44): every aircraft's livery as a tile, virtualized by
 * row so a fleet of thousands stays cheap. Tiles open the aircraft panel.
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
  const { t } = useTranslation("game");
  const panelScrollRef = usePanelScrollRef();
  const listRef = useRef<HTMLDivElement>(null);
  const columns = useColumns();
  const rows = Math.ceil(fleet.length / columns);
  const routeById = useMemo(() => new Map(routes.map((route) => [route.id, route])), [routes]);
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0);
  }, []);

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => panelScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    initialRect: { width: 1024, height: 1200 },
    overscan: 3,
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
        const items = fleet.slice(row.index * columns, row.index * columns + columns);
        return (
          <div
            key={row.key}
            className="absolute left-0 right-0 grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              height: ROW_HEIGHT,
              transform: `translateY(${row.start - scrollMargin}px)`,
            }}
          >
            {items.map((aircraft) => {
              const model = getAircraftById(aircraft.modelId);
              const route = aircraft.assignedRouteId
                ? routeById.get(aircraft.assignedRouteId)
                : null;
              return (
                <button
                  key={aircraft.id}
                  type="button"
                  data-testid="hangar-tile"
                  onClick={() => navigateToAircraft(aircraft.id)}
                  className="group flex h-[184px] flex-col overflow-hidden rounded-2xl border border-border/50 bg-card text-left transition-colors hover:border-primary/50"
                >
                  <div className="relative min-h-0 flex-1">
                    <LiveryThumb
                      imageUrl={aircraft.liveryImageUrl}
                      familyId={model?.familyId}
                      color={airline?.livery.primary}
                      alt={`${airline?.name ?? ""} ${model?.name ?? aircraft.modelId}`.trim()}
                      size="fill"
                      className="rounded-none border-0"
                    />
                  </div>
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-bold text-foreground group-hover:text-primary">
                      {aircraft.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {route
                        ? `${route.originIata} → ${route.destinationIata}`
                        : t("fleet.hangar.parked", { base: aircraft.baseAirportIata })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
