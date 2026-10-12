import { useTranslation } from "react-i18next";
import { Readout } from "@/shared/ui/cockpit";
import { Slab } from "@/shared/ui/ramp";
import { useHubConnections } from "../hooks/useHubConnections";

/**
 * People connecting through this airport on two of the player's flights
 * (S67): how many a day, how well the hub is timed, the biggest flows, and
 * how to time it better when it is not a bank yet.
 */
export function HubConnections({ iata }: { iata: string }) {
  const { t } = useTranslation("game");
  const hub = useHubConnections(iata);
  if (!hub) return null;
  const quality = Math.round(hub.quality * 100);
  return (
    <Slab data-testid="hub-connections" className="flex flex-col gap-2.5 p-3">
      {hub.weekly > 0 ? (
        <span className="text-sm leading-relaxed">
          {t("connections.title", { count: Math.round(hub.weekly / 7), iata })}
        </span>
      ) : null}
      {hub.codeshareWeekly > 0 ? (
        <span className="text-sm leading-relaxed" data-testid="hub-codeshare">
          {t("connections.codeshare", { count: Math.round(hub.codeshareWeekly / 7) })}
        </span>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Readout
          label={t("connections.perDay")}
          value={Math.round(hub.weekly / 7).toLocaleString()}
          tone="normal"
        />
        <Readout
          label={t("connections.bank")}
          value={`${quality}%`}
          tone={quality >= 80 ? "normal" : "caution"}
        />
      </div>
      <span className="font-mono text-[11px] text-ramp-paint/80" data-testid="hub-connection-pairs">
        {hub.pairs
          .slice(0, 4)
          .map(
            (pair) => `${pair.originIata}→${pair.destinationIata} ${Math.round(pair.weekly / 7)}`,
          )
          .join(" · ")}
      </span>
      {quality < 80 ? (
        <span className="text-[11px] text-ramp-paint/80">{t("connections.tip", { iata })}</span>
      ) : null}
    </Slab>
  );
}
