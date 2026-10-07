import type { Route } from "@acars/core";
import { CalendarClock, Fuel, PartyPopper, Plane, Trophy, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { eventPlace, useWorldEventsBoard } from "./useWorldEvents";
import { formatEventHours, type WorldEventView } from "./worldEventsView";

const KIND_ICONS = {
  festival: PartyPopper,
  sportsFinal: Trophy,
  strike: TriangleAlert,
  hubCongestion: Plane,
  fuelSpike: Fuel,
} as const;

function Effects({ view }: { view: WorldEventView }) {
  const { t } = useTranslation("game");
  const signed = (value: number) => `${value > 0 ? "+" : ""}${value}%`;
  const effects = [
    view.demandPct !== 0 && t("worldEvents.effects.demand", { value: signed(view.demandPct) }),
    view.feesPct !== 0 && t("worldEvents.effects.fees", { value: signed(view.feesPct) }),
    view.fuelPct !== 0 && t("worldEvents.effects.fuel", { value: signed(view.fuelPct) }),
  ].filter(Boolean);
  return <>{effects.join(" · ")}</>;
}

function EventRow({ view, upcoming }: { view: WorldEventView; upcoming: boolean }) {
  const { t } = useTranslation("game");
  const Icon = KIND_ICONS[view.event.kind];
  const mine = view.yourRoutes.length > 0;
  return (
    <li
      data-testid={`world-event-${view.event.kind}`}
      data-affects-you={mine}
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-3 py-2.5",
        mine ? "border-amber-500/40 bg-amber-500/5" : "border-transparent",
      )}
    >
      <Icon
        className={cn("mt-0.5 h-5 w-5 shrink-0", mine ? "text-amber-400" : "text-muted-foreground")}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {t(`worldEvents.kinds.${view.event.kind}`)} ·{" "}
          {eventPlace(view.event.airportIata, t("worldEvents.global"))}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <Effects view={view} />
        </p>
        <p className={cn("mt-0.5 text-xs", mine ? "text-amber-300" : "text-muted-foreground/70")}>
          {mine
            ? t("worldEvents.yourRoutes", { routes: view.yourRoutes.slice(0, 4).join(", ") })
            : t("worldEvents.noRoutes")}
        </p>
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {upcoming
          ? t("worldEvents.startsIn", { time: formatEventHours(view.ticksLeft) })
          : t("worldEvents.endsIn", { time: formatEventHours(view.ticksLeft) })}
      </span>
    </li>
  );
}

/**
 * World events (S33.3): what's happening now and in the next day, with its
 * effect on demand, fees or fuel, and which of the player's routes it hits.
 */
export function WorldEventsCard({ routes }: { routes: readonly Route[] }) {
  const { t } = useTranslation("game");
  const board = useWorldEventsBoard(routes);
  const nothing = board.active.length === 0 && board.upcoming.length === 0;

  return (
    <section
      className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm"
      aria-labelledby="world-events-title"
      data-testid="world-events"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {t("worldEvents.kicker")}
          </p>
          <h2 id="world-events-title" className="mt-1 text-lg font-black tracking-tight">
            {t("worldEvents.title")}
          </h2>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/70 p-3 text-primary">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      {nothing ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("worldEvents.empty")}</p>
      ) : (
        <>
          {board.active.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {t("worldEvents.active")}
              </p>
              <ol className="mt-2 space-y-2">
                {board.active.map((view) => (
                  <EventRow key={view.event.id} view={view} upcoming={false} />
                ))}
              </ol>
            </div>
          )}
          {board.upcoming.length > 0 && (
            <div className="mt-4" data-testid="world-events-upcoming">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {t("worldEvents.upcoming")}
              </p>
              <ol className="mt-2 space-y-2">
                {board.upcoming.map((view) => (
                  <EventRow key={view.event.id} view={view} upcoming />
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}
