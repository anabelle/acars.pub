import { fpToNumber } from "@acars/core";
import { useActiveAirline, useEngineStore } from "@acars/store";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Newspaper, Radar } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DailyObjectivesCard } from "@/features/cockpit/components/DailyObjectivesCard";
import { FirstHourChecklist } from "@/features/cockpit/components/FirstHourChecklist";
import { WorldEventsCard } from "@/features/events/WorldEventsCard";
import { findNextLanding, formatCountdown } from "@/features/network/utils/tickerFacts";
import { cn } from "@/shared/lib/utils";

const OPEN_KEY = "acars:home:briefing";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Per-device preference; open unless the player closed it. Storage can be unavailable. */
function savedOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) !== "closed";
  } catch {
    return true;
  }
}

function saveOpen(open: boolean): void {
  try {
    window.localStorage.setItem(OPEN_KEY, open ? "open" : "closed");
  } catch {
    // preference only
  }
}

/** The next landing, on its own tick subscription so the drawer doesn't re-render every tick. */
function NextLanding({ fleet }: { fleet: Parameters<typeof findNextLanding>[0] }) {
  const { t } = useTranslation("game");
  const tick = useEngineStore((state) => state.tick);
  const next = useMemo(() => findNextLanding(fleet, tick), [fleet, tick]);
  return (
    <dd className="truncate font-mono text-sm font-bold" data-testid="briefing-next-landing">
      {next
        ? t("ticker.nextLandingValue", {
            iata: next.destinationIata,
            time: formatCountdown(next.arrivalTick - tick),
          })
        : t("ticker.noLanding")}
    </dd>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/50 bg-background/60 px-2.5 py-2">
      <dt className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      {children}
    </div>
  );
}

/**
 * The home briefing (S56.1, D4 = A): "what matters now" over the live globe.
 * A drawer beside the nav on desktop and a bottom sheet on phones. It reuses
 * the cockpit's own cards (first-hour checklist, daily objectives, world
 * events), and the home route unmounts it while the cockpit is open, so
 * there is only ever one copy of each card on screen.
 */
export function HomeBriefing({ startCollapsed = false }: { startCollapsed?: boolean }) {
  const { t } = useTranslation(["game"]);
  const { airline, fleet, routes, timeline, isViewingOther } = useActiveAirline();
  const [open, setOpen] = useState(() => !startCollapsed && savedOpen());
  const toggle = () =>
    setOpen((current) => {
      saveOpen(!current);
      return !current;
    });

  const activeRoutes = useMemo(
    () => routes.filter((route) => route.status === "active").length,
    [routes],
  );
  const inAir = useMemo(
    () => fleet.filter((aircraft) => aircraft.status === "enroute").length,
    [fleet],
  );
  if (!airline) return null;

  const stats = (
    <dl className="grid grid-cols-2 gap-2" data-testid="briefing-stats">
      <Stat label={t("briefing.cash")}>
        <dd className="truncate font-mono text-sm font-bold">
          {money.format(Math.round(fpToNumber(airline.corporateBalance)))}
        </dd>
      </Stat>
      <Stat label={t("briefing.routes")}>
        <dd className="font-mono text-sm font-bold">{activeRoutes}</dd>
      </Stat>
      <Stat label={t("briefing.inAir")}>
        <dd className="font-mono text-sm font-bold">{inAir}</dd>
      </Stat>
      <Stat label={t("ticker.nextLanding")}>
        <NextLanding fleet={fleet} />
      </Stat>
    </dl>
  );

  return (
    <div className="pointer-events-none flex h-full w-full items-end sm:items-stretch sm:justify-start">
      <section
        data-testid="home-briefing"
        data-open={open}
        aria-labelledby="home-briefing-title"
        className={cn(
          "pointer-events-auto flex w-full flex-col overflow-hidden rounded-[24px] border border-border/70 bg-background/80 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:max-w-sm",
          // Folded, it shrinks to its summary instead of stretching down the side.
          open ? "max-h-[60dvh] sm:max-h-full" : "sm:self-start",
        )}
      >
        <header className="flex items-center gap-3 px-4 pt-4 pb-3">
          <Newspaper className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
              {t("briefing.kicker")}
            </p>
            <h1
              id="home-briefing-title"
              className="truncate text-base font-black tracking-tight text-foreground"
            >
              {airline.name}
            </h1>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="home-briefing-body"
            data-testid="home-briefing-toggle"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            aria-label={t(open ? "briefing.collapse" : "briefing.expand")}
            title={t(open ? "briefing.collapse" : "briefing.expand")}
          >
            {/* Phones: the sheet slides down; desktop: the drawer folds up. */}
            {open ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </header>
        <div className="px-4 pb-4">{stats}</div>
        {open ? (
          <div
            id="home-briefing-body"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto border-t border-border/50 px-4 py-4"
          >
            {!isViewingOther && (
              <>
                <FirstHourChecklist
                  routes={routes}
                  fleet={fleet}
                  timeline={timeline}
                  cumulativeRevenue={airline.cumulativeRevenue}
                />
                <DailyObjectivesCard ledger={airline.objectives} />
                <WorldEventsCard routes={routes} />
              </>
            )}
            <Link
              to="/"
              search={{ panel: "cockpit" }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <Radar className="h-4 w-4" aria-hidden="true" />
              {t("home.openCockpit")}
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
