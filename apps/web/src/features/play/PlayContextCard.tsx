import { useAirlineStore } from "@acars/store";
import { Link } from "@tanstack/react-router";
import { MapPin, Plane, Route as RouteIcon, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RouteArc } from "./arcs";
import { airportCardModel, planeCardModel, routeCardModel } from "./cardModels";
import type { PlaySelection } from "./selection";
import { lookupAirport } from "./usePlayArcs";
import { nowTick } from "./usePlayPlanes";

const cardClass =
  "pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-black/75 p-4 text-white shadow-2xl backdrop-blur";
const linkClass =
  "mt-3 inline-block rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground";

/**
 * The contextual card (S45.3): what was clicked on the globe, in a sentence
 * or two, and a door into the classic view for the details.
 */
export function PlayContextCard({
  selection,
  arcs,
  onClose,
}: {
  selection: PlaySelection;
  arcs: readonly RouteArc[];
  onClose: () => void;
}) {
  const { t } = useTranslation("game");
  const pubkey = useAirlineStore((s) => s.pubkey);
  const airline = useAirlineStore((s) => s.airline);
  const competitors = useAirlineStore((s) => s.competitors);
  const nameOf = (owner: string) =>
    owner === pubkey ? airline?.name : competitors.get(owner)?.name;

  const close = (
    <button
      type="button"
      onClick={onClose}
      aria-label={t("play.card.close")}
      className="absolute right-2 top-2 rounded-full p-1.5 text-white/60 hover:text-white"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  if (selection.kind === "route") {
    const model = routeCardModel(selection.arc, nameOf);
    return (
      <section data-testid="play-card" data-kind="route" className={`relative ${cardClass}`}>
        {close}
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
          <RouteIcon className="h-3 w-3" aria-hidden="true" />
          {model.isPlayer ? t("play.card.yourRoute") : t("play.card.rivalRoute")}
        </p>
        <h2 className="mt-1 font-mono text-lg font-black">
          {model.originIata} → {model.destinationIata}
        </h2>
        <p className="text-xs text-white/70">
          {t("play.card.routeLine", {
            owner: model.ownerName,
            frequency: model.frequencyPerWeek,
            distance: model.distanceKm.toLocaleString(),
          })}
        </p>
        <Link to="/airport/$iata" params={{ iata: model.destinationIata }} className={linkClass}>
          {t("play.card.openClassic")}
        </Link>
      </section>
    );
  }

  if (selection.kind === "airport") {
    const model = airportCardModel(selection.airport.iata, arcs);
    const airport = lookupAirport(model.iata);
    return (
      <section data-testid="play-card" data-kind="airport" className={`relative ${cardClass}`}>
        {close}
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          {t("play.card.airport")}
        </p>
        <h2 className="mt-1 text-lg font-black">
          <span className="font-mono">{model.iata}</span>
          {airport ? ` · ${airport.city}` : ""}
        </h2>
        {airport && <p className="text-xs text-white/60">{airport.name}</p>}
        <p className="mt-1 text-xs text-white/70">
          {t("play.card.airportLine", { yours: model.yourRoutes, world: model.worldRoutes })}
        </p>
        <Link to="/airport/$iata" params={{ iata: model.iata }} className={linkClass}>
          {t("play.card.openClassic")}
        </Link>
      </section>
    );
  }

  const model = planeCardModel(selection.plane, nowTick());
  return (
    <section data-testid="play-card" data-kind="plane" className={`relative ${cardClass}`}>
      {close}
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
        <Plane className="h-3 w-3" aria-hidden="true" />
        {model.synthetic
          ? t("play.card.syntheticPlane")
          : model.isPlayer
            ? t("play.card.yourPlane")
            : t("play.card.rivalPlane")}
      </p>
      {model.synthetic ? (
        <p className="mt-1 text-xs text-white/70">{t("play.card.syntheticLine")}</p>
      ) : (
        <>
          <h2 className="mt-1 font-mono text-lg font-black">
            {model.originIata} → {model.destinationIata}
          </h2>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-primary" style={{ width: `${model.progressPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-white/70">
            {t("play.card.planeLine", { progress: model.progressPct, minutes: model.minutesLeft })}
          </p>
        </>
      )}
    </section>
  );
}
