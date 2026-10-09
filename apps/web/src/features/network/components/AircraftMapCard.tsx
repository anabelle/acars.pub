import type { AircraftInstance } from "@acars/core";
import { getAircraftById } from "@acars/data";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { Plane } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatCountdown } from "@/features/network/utils/tickerFacts";
import { MAP_CARD_PRIMARY_ACTION, MapCard, MapCardStat } from "./MapCard";

const STATUS_KEYS: Record<AircraftInstance["status"], string> = {
  enroute: "aircraftPanel.status.enroute",
  turnaround: "aircraftPanel.status.turnaround",
  idle: "aircraftPanel.status.idle",
  maintenance: "aircraftPanel.status.maintenance",
  delivery: "aircraftPanel.status.delivery",
};

/** The leg's progress and time to landing, on its own tick subscription. */
function FlightProgress({ flight }: { flight: NonNullable<AircraftInstance["flight"]> }) {
  const { t } = useTranslation("game");
  const tick = useEngineStore((s) => s.tick);
  const duration = Math.max(1, flight.arrivalTick - flight.departureTick);
  const progress = Math.min(1, Math.max(0, (tick - flight.departureTick) / duration));
  return (
    <>
      <MapCardStat
        label={t("aircraftMapCard.progress")}
        value={`${Math.round(progress * 100)}%`}
        testId="aircraft-card-progress"
      />
      <MapCardStat
        label={t("aircraftMapCard.landsIn")}
        value={formatCountdown(flight.arrivalTick - tick)}
      />
    </>
  );
}

/**
 * The card an aircraft opens on the globe (S56.3): whose it is, what it is
 * doing, where it flies and when it lands, with a door into the full
 * aircraft panel.
 */
export function AircraftMapCard({
  aircraft,
  isPlayer,
  onOpenDetails,
  onClose,
}: {
  aircraft: AircraftInstance;
  isPlayer: boolean;
  onOpenDetails: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("game");
  const competitors = useAirlineStore((s) => s.competitors);
  const model = getAircraftById(aircraft.modelId);
  const owner = isPlayer
    ? t("aircraftMapCard.yours")
    : (competitors.get(aircraft.ownerPubkey)?.name ?? t("aircraftMapCard.rival"));
  const flight = aircraft.status === "enroute" ? aircraft.flight : null;

  return (
    <MapCard
      testId="aircraft-card"
      data-owner={isPlayer ? "player" : "rival"}
      icon={Plane}
      kicker={t("aircraftMapCard.kicker")}
      title={aircraft.name}
      subtitle={[model?.name, owner].filter(Boolean).join(" · ")}
      closeLabel={t("aircraftMapCard.close")}
      onClose={onClose}
      actions={
        <button type="button" onClick={onOpenDetails} className={MAP_CARD_PRIMARY_ACTION}>
          {t("aircraftMapCard.openDetails")}
        </button>
      }
    >
      <dl className="mt-3 grid grid-cols-2 gap-2">
        <MapCardStat
          label={t("aircraftMapCard.status")}
          value={t(STATUS_KEYS[aircraft.status] ?? STATUS_KEYS.idle)}
          testId="aircraft-card-status"
        />
        <MapCardStat
          label={flight ? t("aircraftMapCard.route") : t("aircraftMapCard.base")}
          value={
            flight
              ? `${flight.originIata} → ${flight.destinationIata}`
              : (aircraft.baseAirportIata ?? "—")
          }
          testId="aircraft-card-where"
        />
        {flight ? <FlightProgress flight={flight} /> : null}
      </dl>
    </MapCard>
  );
}
