import { type Airport, getActiveEvents } from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { MapPin } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MAP_CARD_PRIMARY_ACTION, MapCard, MapCardStat } from "./MapCard";

/**
 * The card an airport opens on the globe (S56.3): your routes and aircraft
 * there, whose hub it is, any world event on now, and a door into the full
 * airport panel (routes from your hub, flights, rivals).
 */
export function AirportMapCard({
  airport,
  onOpenDetails,
  onClose,
}: {
  airport: Airport;
  onOpenDetails: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("game");
  const airline = useAirlineStore((s) => s.airline);
  const routes = useAirlineStore((s) => s.routes);
  const fleet = useAirlineStore((s) => s.fleet);
  const competitors = useAirlineStore((s) => s.competitors);
  // Events change by the hour: a coarse tick keeps this card from re-rendering every tick.
  const hour = useEngineStore((s) => Math.floor(s.tick / 1200));
  const { iata } = airport;

  const yourRoutes = useMemo(
    () =>
      routes.filter(
        (route) =>
          route.status === "active" &&
          (route.originIata === iata || route.destinationIata === iata),
      ).length,
    [routes, iata],
  );
  const yourAircraft = useMemo(
    () =>
      fleet.filter((aircraft) => aircraft.status !== "enroute" && aircraft.baseAirportIata === iata)
        .length,
    [fleet, iata],
  );
  const rivalHubs = useMemo(() => {
    let count = 0;
    competitors.forEach((rival) => {
      if (rival.hubs?.includes(iata)) count++;
    });
    return count;
  }, [competitors, iata]);
  const event = useMemo(
    () => getActiveEvents(hour * 1200).find((active) => active.airportIata === iata) ?? null,
    [hour, iata],
  );
  const isYourHub = airline?.hubs?.includes(iata) ?? false;

  const hubLine = isYourHub
    ? t("airportMapCard.yourHub")
    : rivalHubs > 0
      ? t("airportMapCard.rivalHubs", { count: rivalHubs })
      : t("airportMapCard.noHub");

  return (
    <MapCard
      testId="airport-card"
      data-iata={iata}
      icon={MapPin}
      kicker={t("airportMapCard.kicker")}
      title={airport.name}
      subtitle={`${iata} · ${airport.city}, ${airport.country}`}
      closeLabel={t("airportMapCard.close")}
      onClose={onClose}
      actions={
        <button type="button" onClick={onOpenDetails} className={MAP_CARD_PRIMARY_ACTION}>
          {t("airportMapCard.openDetails")}
        </button>
      }
    >
      <dl className="mt-3 grid grid-cols-2 gap-2">
        <MapCardStat
          label={t("airportMapCard.yourRoutes")}
          value={yourRoutes}
          testId="airport-card-routes"
        />
        <MapCardStat label={t("airportMapCard.yourAircraft")} value={yourAircraft} />
      </dl>
      <p className="mt-2 text-xs text-muted-foreground" data-testid="airport-card-hub">
        {hubLine}
      </p>
      {event ? (
        <p className="mt-1 text-xs font-semibold text-amber-300" data-testid="airport-card-event">
          {t("airportMapCard.event", { kind: t(`worldEvents.kinds.${event.kind}`) })}
        </p>
      ) : null}
    </MapCard>
  );
}
