import { useAirlineStore } from "@acars/store";
import { Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { resolvePlayPrototypeFlag } from "@/features/play/playFlag";
import { usePlayArcs } from "@/features/play/usePlayArcs";

// deck.gl + MapLibre load only when the prototype is on.
const PlayGlobe = lazy(() =>
  import("@/features/play/PlayGlobe").then((m) => ({ default: m.PlayGlobe })),
);

/**
 * `/play` (S45): the globe-first prototype. The world is the whole screen;
 * later steps add aircraft, the briefing drawer and contextual cards.
 */
export default function PlayPage() {
  const { t } = useTranslation("game");
  const [enabled] = useState(() => resolvePlayPrototypeFlag(window.location.search));

  if (!enabled) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div
          data-testid="play-disabled"
          className="max-w-sm rounded-2xl border border-border/60 bg-background/90 p-6 text-center shadow-2xl"
        >
          <FlaskConical className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-black">{t("play.disabledTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("play.disabledBody")}</p>
          <div className="mt-4 flex justify-center gap-2">
            <a
              href="/play?prototype=on"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground"
            >
              {t("play.enable")}
            </a>
            <Link
              to="/"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold"
            >
              {t("play.back")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <PlayShell />;
}

function PlayShell() {
  const { t } = useTranslation("game");
  const airline = useAirlineStore((s) => s.airline);
  const arcs = usePlayArcs();
  const playerArcs = arcs.filter((arc) => arc.isPlayer).length;

  return (
    <div data-testid="play-shell" className="relative h-full w-full bg-black">
      <Suspense fallback={null}>
        <PlayGlobe arcs={arcs} />
      </Suspense>
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/60 px-4 py-2 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
            {t("play.badge")}
          </p>
          <p className="text-sm font-black text-white">{airline?.name ?? "ACARS"}</p>
          <p data-testid="play-route-summary" className="text-xs text-white/70">
            {t("play.routeSummary", { yours: playerArcs, world: arcs.length })}
          </p>
        </div>
        <Link
          to="/"
          className="pointer-events-auto rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-black/80"
        >
          {t("play.classic")}
        </Link>
      </header>
    </div>
  );
}
