import { fpToNumber } from "@acars/core";
import type { RouteSelection } from "@acars/map";
import { useAirlineStore } from "@acars/store";
import { Link } from "@tanstack/react-router";
import { Route as RouteIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRoutePerformance } from "@/features/corporate/hooks/useRoutePerformance";
import {
  MAP_CARD_PRIMARY_ACTION,
  MAP_CARD_SECONDARY_ACTION,
  MapCard,
  MapCardStat,
} from "./MapCard";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * The card a route arc opens on the globe (S56.2): who flies it, how often and
 * how far, and for your own routes how it earns, with doors to the route list
 * (fares and frequency) and to either airport. A bottom sheet on phones.
 */
export function RouteMapCard({
  selection,
  onClose,
}: {
  selection: RouteSelection;
  onClose: () => void;
}) {
  const { t } = useTranslation("game");
  const routes = useAirlineStore((s) => s.routes);
  const timeline = useAirlineStore((s) => s.timeline);
  const routesByOwner = useAirlineStore((s) => s.routesByOwner);
  const competitors = useAirlineStore((s) => s.competitors);
  const performance = useRoutePerformance(timeline, routes);

  const route = useMemo(() => {
    const own = selection.isPlayer
      ? routes.find((r) => r.id === selection.routeId)
      : routesByOwner.get(selection.ownerPubkey)?.find((r) => r.id === selection.routeId);
    return own ?? null;
  }, [selection, routes, routesByOwner]);
  const stats = selection.isPlayer
    ? performance.find((entry) => entry.routeId === selection.routeId)
    : undefined;
  const ownerName = selection.isPlayer
    ? t("routeMapCard.yours")
    : (competitors.get(selection.ownerPubkey)?.name ?? t("routeMapCard.rival"));

  const { originIata, destinationIata } = selection;
  return (
    <MapCard
      testId="route-card"
      data-owner={selection.isPlayer ? "player" : "rival"}
      icon={RouteIcon}
      kicker={t("routeMapCard.kicker")}
      title={
        <span className="font-mono">
          {originIata} ⇄ {destinationIata}
        </span>
      }
      subtitle={<span data-testid="route-card-owner">{ownerName}</span>}
      closeLabel={t("routeMapCard.close")}
      onClose={onClose}
      actions={
        <>
          {selection.isPlayer ? (
            <Link
              to="/network"
              search={{ tab: "active" }}
              onClick={onClose}
              className={MAP_CARD_PRIMARY_ACTION}
            >
              {t("routeMapCard.manage")}
            </Link>
          ) : null}
          {[originIata, destinationIata].map((iata) => (
            <Link
              key={iata}
              to="/airport/$iata"
              params={{ iata }}
              onClick={onClose}
              className={`${MAP_CARD_SECONDARY_ACTION} font-mono`}
            >
              {t("routeMapCard.openAirport", { iata })}
            </Link>
          ))}
        </>
      }
    >
      <dl className="mt-3 grid grid-cols-2 gap-2">
        <MapCardStat
          label={t("routeMapCard.frequency")}
          value={route?.frequencyPerWeek != null ? `${route.frequencyPerWeek}×` : "—"}
          testId="route-card-frequency"
        />
        <MapCardStat
          label={t("routeMapCard.distance")}
          value={route ? `${Math.round(route.distanceKm).toLocaleString()} km` : "—"}
        />
        {selection.isPlayer ? (
          <>
            <MapCardStat
              label={t("routeMapCard.profit")}
              value={stats ? money.format(Math.round(fpToNumber(stats.profitPerHour))) : "—"}
              testId="route-card-profit"
            />
            <MapCardStat
              label={t("routeMapCard.loadFactor")}
              value={stats ? `${Math.round(stats.avgLoadFactor * 100)}%` : "—"}
            />
          </>
        ) : null}
      </dl>
      {selection.isPlayer && !stats ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{t("routeMapCard.noLandings")}</p>
      ) : null}
    </MapCard>
  );
}
