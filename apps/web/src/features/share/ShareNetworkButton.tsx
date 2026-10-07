import type { AircraftInstance, AirlineEntity, Route } from "@acars/core";
import { getAirports, isDataCatalogReady } from "@acars/data";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { airlinePath } from "@/features/airline/utils/airlineKey";
import { cn } from "@/shared/lib/utils";
import {
  browserShareApi,
  downloadBlob,
  type ShareApi,
  shareFileName,
  shareNetwork,
  summaryFromState,
} from "./shareNetwork";

let airportIndex: Map<string, { iata: string; latitude: number; longitude: number }> | null = null;
const airportByIata = (iata: string) => {
  if (!airportIndex && isDataCatalogReady()) {
    airportIndex = new Map(getAirports().map((airport) => [airport.iata, airport]));
  }
  return airportIndex?.get(iata);
};

/**
 * "Share my network" (S51.1): the airline's network card plus its public
 * page link, through the share sheet, or copied with the image to download.
 */
export function ShareNetworkButton({
  pubkey,
  airline,
  fleet,
  routes,
  className,
  api = browserShareApi,
}: {
  pubkey: string;
  airline: AirlineEntity;
  fleet: readonly AircraftInstance[];
  routes: readonly Route[];
  className?: string;
  /** Injectable for tests. */
  api?: () => ShareApi;
}) {
  const { t } = useTranslation("game");
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      const summary = summaryFromState(airline, fleet, routes);
      const fileName = shareFileName(airline.icaoCode);
      const outcome = await shareNetwork({
        summary,
        url: `${window.location.origin}${airlinePath(pubkey)}`,
        title: t("share.title", { name: airline.name }),
        text: t("share.text", { routes: summary.routes, aircraft: summary.aircraft }),
        airportByIata,
        api: api(),
        fileName,
      });
      if (outcome.kind === "copied") {
        toast.success(t("share.copied"), {
          action: {
            label: t("share.download"),
            onClick: () => downloadBlob(outcome.image, fileName),
          },
        });
      }
    } catch {
      toast.error(t("share.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      disabled={busy}
      data-testid="share-network"
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-bold hover:bg-accent disabled:opacity-60",
        className,
      )}
    >
      <Share2 className="h-4 w-4" aria-hidden="true" />
      {busy ? t("share.sharing") : t("share.button")}
    </button>
  );
}
