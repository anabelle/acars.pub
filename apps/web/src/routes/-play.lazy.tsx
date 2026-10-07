import { useAirlineStore } from "@acars/store";
import { Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { resolvePlayPrototypeFlag } from "@/features/play/playFlag";
import { usePlayArcs } from "@/features/play/usePlayArcs";
import { PLAY_LOADS, parseLoad, usePlayPlanes } from "@/features/play/usePlayPlanes";

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
  const [{ load, orbit }] = useState(() => ({
    load: parseLoad(window.location.search),
    orbit: new URLSearchParams(window.location.search).get("orbit") === "1",
  }));
  const arcs = usePlayArcs();
  const planes = usePlayPlanes(load);
  const playerArcs = arcs.filter((arc) => arc.isPlayer).length;

  return (
    <div data-testid="play-shell" className="relative h-full w-full bg-black">
      <Suspense fallback={null}>
        <PlayGlobe arcs={arcs} planes={planes} orbit={orbit} />
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
          <p data-testid="play-plane-summary" className="text-xs text-white/70">
            {t("play.planeSummary", { count: planes.length })}
          </p>
          {/* Load generator (S45.2): synthetic traffic for the perf report. */}
          <nav aria-label={t("play.loadLabel")} className="mt-1 flex gap-1">
            {PLAY_LOADS.map((value) => (
              <a
                key={value}
                href={`/play?load=${value}`}
                aria-current={value === load ? "true" : undefined}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${value === load ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
              >
                {value === 0 ? t("play.loadNone") : `+${value / 1000}k`}
              </a>
            ))}
          </nav>
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
