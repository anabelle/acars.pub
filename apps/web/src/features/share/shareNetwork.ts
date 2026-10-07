import type { AircraftInstance, AirlineEntity, Route } from "@acars/core";
import { getAirports, isDataCatalogReady } from "@acars/data";
import { renderAirlineCardPng } from "@/features/airline/utils/ogImage";
import type { AirlineSummary } from "@/features/airline/utils/ogMeta";
import type { MapAirport } from "@/features/airline/utils/routeMap";

/**
 * The share card's input, built from the live airline state (the same shape
 * the public page's link preview builds from a checkpoint).
 */
export function summaryFromState(
  airline: Pick<AirlineEntity, "name" | "icaoCode" | "tier" | "hubs" | "livery">,
  fleet: readonly Pick<AircraftInstance, "liveryImageUrl">[],
  routes: readonly Pick<Route, "originIata" | "destinationIata" | "status">[],
): AirlineSummary {
  const active = routes.filter((route) => route.status === "active");
  const liveried = fleet.find((ac) => ac.liveryImageUrl?.startsWith("https://"));
  return {
    name: airline.name.trim().slice(0, 60),
    icaoCode: airline.icaoCode.slice(0, 4),
    tier: airline.tier,
    aircraft: fleet.length,
    routes: active.length,
    hubs: [...airline.hubs],
    colors: { primary: airline.livery.primary, accent: airline.livery.accent },
    routeList: active.map((route) => ({
      originIata: route.originIata,
      destinationIata: route.destinationIata,
    })),
    liveryImageUrl: liveried?.liveryImageUrl ?? null,
  };
}

/** The browser APIs a share needs (injectable for tests). */
export interface ShareApi {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  writeText: (text: string) => Promise<void>;
}

export const browserShareApi = (): ShareApi => ({
  share: typeof navigator.share === "function" ? navigator.share.bind(navigator) : undefined,
  canShare:
    typeof navigator.canShare === "function" ? navigator.canShare.bind(navigator) : undefined,
  writeText: (text) => navigator.clipboard.writeText(text),
});

export type ShareOutcome =
  /** The share sheet took the image and the link. */
  | { kind: "sharedImage" }
  /** The share sheet took the link only (no file sharing). */
  | { kind: "sharedLink" }
  /** No share sheet: the link was copied; the image is offered for download. */
  | { kind: "copied"; image: Blob }
  /** The player closed the share sheet. */
  | { kind: "cancelled" };

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/**
 * Shares the airline's network (S51): the share card image plus the public
 * page link through the system share sheet when the browser can share
 * files (mostly mobile), the link alone when it can only share links, and
 * a copied link (with the image to download) when there's no share sheet.
 */
export async function shareNetwork({
  summary,
  url,
  title,
  text,
  airportByIata,
  api,
  fileName,
}: {
  summary: AirlineSummary;
  url: string;
  title: string;
  text: string;
  airportByIata: (iata: string) => MapAirport | undefined;
  api: ShareApi;
  fileName: string;
}): Promise<ShareOutcome> {
  const png = await renderAirlineCardPng(summary, airportByIata);
  const image = new Blob([png], { type: "image/png" });
  try {
    if (api.share) {
      const file = new File([image], fileName, { type: "image/png" });
      const withImage: ShareData = { files: [file], title, text, url };
      if (api.canShare?.(withImage)) {
        await api.share(withImage);
        return { kind: "sharedImage" };
      }
      await api.share({ title, text, url });
      return { kind: "sharedLink" };
    }
  } catch (error) {
    if (isAbort(error)) return { kind: "cancelled" };
    // Share sheet failed (e.g. not allowed here): fall back to copying.
  }
  await api.writeText(url);
  return { kind: "copied", image };
}

/** "acars-ibr-network.png" */
export const shareFileName = (icaoCode: string) =>
  `acars-${(icaoCode || "airline").toLowerCase().replace(/[^a-z0-9]/g, "")}-network.png`;

/** Saves a blob as a file through a temporary link. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

let airportIndex: Map<string, MapAirport> | null = null;
/** Airport coordinates for the share card, once the catalog has loaded. */
export function catalogAirportByIata(iata: string): MapAirport | undefined {
  if (!airportIndex && isDataCatalogReady()) {
    airportIndex = new Map(getAirports().map((airport) => [airport.iata, airport]));
  }
  return airportIndex?.get(iata);
}
