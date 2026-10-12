import type { TimelineEvent } from "@acars/core";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PaxCrowd, Slab } from "@/shared/ui/ramp";
import { turnedAwayAt } from "../utils/turnedAway";

/**
 * People who could not get a seat on the player's flights from this airport
 * in the last 24 h (S63), as pictograms, with the way to add seats.
 */
export function TurnedAwayHere({
  iata,
  timeline,
  tick,
}: {
  iata: string;
  timeline: readonly TimelineEvent[];
  tick: number;
}) {
  const { t } = useTranslation("game");
  const navigate = useNavigate();
  const summary = useMemo(() => turnedAwayAt(timeline, iata, tick), [timeline, iata, tick]);
  if (summary.turnedAway === 0) return null;
  return (
    <Slab edge="idle" data-testid="turned-away-here" className="flex flex-col gap-2.5 p-3">
      <span className="text-sm leading-relaxed">
        {t("turnedAway.title", { count: summary.turnedAway, iata })}
      </span>
      <PaxCrowd
        segments={[
          { count: summary.boarded, tone: "paint", label: t("today.boarded") },
          { count: summary.turnedAway, tone: "caution", label: t("today.stayedBehind") },
        ]}
      />
      <span className="font-mono text-[11px] text-ramp-paint/80">
        {summary.byDestination
          .slice(0, 4)
          .map((entry) => `→ ${entry.iata} ${entry.count}`)
          .join(" · ")}
      </span>
      <button
        type="button"
        onClick={() => navigate({ to: "/network", search: { tab: "active" } as never })}
        className="min-h-10 self-start rounded-[3px] bg-sign-yellow px-3 font-sign text-sm font-extrabold uppercase tracking-[0.06em] text-sign-black"
      >
        {t("today.addCapacity")} ▶
      </button>
    </Slab>
  );
}
