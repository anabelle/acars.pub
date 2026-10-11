import type { AircraftInstance, AirlineEntity } from "@acars/core";
import { aircraftModels } from "@acars/data";
import { useAirlineStore } from "@acars/store";
import { Lock } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FamilySilhouette } from "@/shared/components/FamilySilhouette";
import { modelLabel } from "@/shared/theme/livery";
import { Sign, Slab } from "@/shared/ui/ramp";
import { type SpotterEntry, spotterEntries } from "../utils/spotter";
import { AircraftLiveryImage } from "./AircraftLiveryImage";
import { CatalogImage } from "./CatalogImage";
import { LiveryFallback } from "./LiveryFallback";

/**
 * The spotter's book (S61): every type in the catalog, the ones the airline
 * flies, the ones it can order next and the ones a higher tier unlocks.
 * The catalog is a fixed few dozen types, so a plain grid is enough.
 */
export function SpotterBook({ fleet, tier }: { fleet: readonly AircraftInstance[]; tier: number }) {
  const { t } = useTranslation("game");
  const airline = useAirlineStore((s) => s.airline);
  const book = useMemo(() => spotterEntries(aircraftModels, fleet, tier), [fleet, tier]);
  // Owned types show the airline's own painting: the collection is yours.
  const firstOfModel = useMemo(() => {
    const first = new Map<string, AircraftInstance>();
    for (const aircraft of fleet)
      if (!first.has(aircraft.modelId)) first.set(aircraft.modelId, aircraft);
    return first;
  }, [fleet]);
  return (
    <section data-testid="spotter-book" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Sign variant="location">{t("fleet.spotter.title")}</Sign>
        <span className="font-mono text-sm text-ramp-paint" data-testid="spotter-progress">
          {t("fleet.spotter.progress", { owned: book.owned, total: book.total })}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-[2px] bg-black/30">
        <div
          className="h-full bg-sign-yellow"
          style={{ width: `${(book.owned / Math.max(1, book.total)) * 100}%` }}
        />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {book.entries.map((entry) => (
          <SpotterCard
            key={entry.model.id}
            entry={entry}
            airline={airline}
            example={firstOfModel.get(entry.model.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function SpotterCard({
  entry,
  airline,
  example,
}: {
  entry: SpotterEntry;
  airline: AirlineEntity | null;
  example: AircraftInstance | undefined;
}) {
  const { t } = useTranslation("game");
  const { model, state, count } = entry;
  const locked = state === "locked";
  return (
    <li data-testid="spotter-card" data-state={state}>
      <Slab edge={state === "owned" ? "sign" : "none"} className="flex h-full flex-col gap-2 p-2">
        <div
          className={`relative aspect-[4/3] overflow-hidden rounded-[2px] bg-cockpit-panel ${locked ? "opacity-40 grayscale" : ""}`}
        >
          {state === "owned" && example ? (
            <AircraftLiveryImage
              aircraft={example}
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
          ) : locked ? (
            <div className="flex h-full w-full items-center justify-center text-ramp-paint/50">
              <FamilySilhouette familyId={model.familyId} className="h-2/3 w-2/3" />
            </div>
          ) : (
            <CatalogImage
              model={model}
              fallback={
                <div className="flex h-full w-full items-center justify-center text-ramp-paint/60">
                  <FamilySilhouette familyId={model.familyId} className="h-2/3 w-2/3" />
                </div>
              }
            />
          )}
          {state === "owned" ? (
            <span className="absolute right-1.5 top-1.5 rounded-[2px] bg-sign-black px-1.5 py-0.5 font-mono text-[11px] font-bold text-sign-yellow">
              ×{count}
            </span>
          ) : null}
        </div>
        <span className="truncate text-sm font-bold text-ramp-paint">
          {modelLabel(model.manufacturer, model.name)}
        </span>
        <span
          className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] ${
            state === "owned"
              ? "text-sign-yellow"
              : state === "next"
                ? "text-nd-cyan"
                : "text-ramp-paint/60"
          }`}
        >
          {locked ? <Lock className="h-3 w-3" aria-hidden="true" /> : null}
          {state === "owned"
            ? t("fleet.spotter.owned")
            : state === "next"
              ? t("fleet.spotter.next")
              : t("fleet.spotter.locked", { tier: model.unlockTier })}
        </span>
      </Slab>
    </li>
  );
}
