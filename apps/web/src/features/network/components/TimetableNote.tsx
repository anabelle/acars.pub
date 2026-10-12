import type { ChangeTiming, FlightOffer, Route } from "@acars/core";
import { fpFormat } from "@acars/core";
import { CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Published timetables (S69): what a route has announced for 00:00 UTC, and
 * when a change made now will take effect.
 */
export function TimetableAnnounced({ route }: { route: Route }) {
  const { t } = useTranslation(["game"]);
  const pending = route.pending;
  if (!pending) return null;
  const changes = [
    pending.fareEconomy !== undefined ? `E ${fpFormat(pending.fareEconomy, 0)}` : null,
    pending.fareBusiness !== undefined ? `B ${fpFormat(pending.fareBusiness, 0)}` : null,
    pending.fareFirst !== undefined ? `F ${fpFormat(pending.fareFirst, 0)}` : null,
    pending.frequencyPerWeek !== undefined
      ? t("routeManager.frequency.perWeek", { ns: "game", count: pending.frequencyPerWeek })
      : null,
  ].filter(Boolean);
  return (
    <span
      data-testid="timetable-announced"
      className="inline-flex items-center gap-1 self-start rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"
    >
      <CalendarClock className="h-3 w-3" aria-hidden="true" />
      {t("timetable.announced", { ns: "game", changes: changes.join(" · ") })}
    </span>
  );
}

/** When a change made now takes effect. */
export function TimetableHint({ timing }: { timing: ChangeTiming }) {
  const { t } = useTranslation(["game"]);
  const key =
    timing.when === "tomorrow"
      ? "timetable.tomorrow"
      : timing.reason === "newCapacity"
        ? "timetable.newCapacity"
        : "timetable.now";
  return (
    <p data-testid="timetable-hint" className="text-[11px] text-muted-foreground">
      {t(key, { ns: "game" })}
    </p>
  );
}

/** A rival's announced economy fare, if it has one still to come. */
export function RivalAnnounced({ offer, tick }: { offer: FlightOffer; tick: number }) {
  const { t } = useTranslation(["game"]);
  const next = offer.next;
  if (!next || next.fareEconomy === undefined || tick >= next.effectiveTick) return null;
  return (
    <span data-testid="rival-announced" className="text-[9px] font-semibold text-amber-300">
      {t("timetable.rivalAnnounced", { ns: "game", economy: fpFormat(next.fareEconomy, 0) })}
    </span>
  );
}
