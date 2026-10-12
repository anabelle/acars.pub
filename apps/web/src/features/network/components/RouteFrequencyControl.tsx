import type { Route } from "@acars/core";
import {
  legTicksFor,
  MAX_ROUTE_FREQUENCY_PER_WEEK,
  MIN_ROUTE_FREQUENCY_PER_WEEK,
  maxWeeklyFrequency,
  routeAt,
  scheduleChangeTiming,
  TICKS_PER_HOUR,
} from "@acars/core";
import { getAircraftById } from "@acars/data";
import { lastJoinTickOn, useAirlineStore, useEngineStore } from "@acars/store";
import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useFrequencyCurve } from "../hooks/useFrequencyCurve";
import { RouteUtilization } from "./RouteUtilization";
import { TimetableHint } from "./TimetableNote";
import { WhatIfCurve } from "./WhatIfCurve";

type Props = {
  route: Route;
};

/**
 * Round trips a week on a route (S14): the engine flies exactly this many,
 * capped by what the assigned aircraft can physically fly. Steps locally and
 * publishes one action on "Apply". Shows how long each plane flies a day and
 * offers the suggested frequency in one tap when planes sit idle (S58).
 * On a published route the change is announced for 00:00 UTC (S69).
 */
export function RouteFrequencyControl({ route }: Props) {
  const { t } = useTranslation(["game"]);
  const fleet = useAirlineStore((s) => s.fleet);
  const updateRouteFrequency = useAirlineStore((s) => s.updateRouteFrequency);
  // What the player has asked for: today's schedule, or the one announced (S69).
  const current = routeAt(route, Number.POSITIVE_INFINITY).frequencyPerWeek ?? 7;
  const minuteTick = useEngineStore(
    (s) => Math.floor(s.tick / (TICKS_PER_HOUR / 60)) * (TICKS_PER_HOUR / 60),
  );
  const [draft, setDraft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [whatIf, setWhatIf] = useState(false);
  const value = draft ?? current;
  const curve = useFrequencyCurve(route, whatIf);

  // The slowest assigned aircraft sets the pace (longest round trip).
  const physicalMax = useMemo(() => {
    const assigned = fleet.filter((aircraft) => aircraft.assignedRouteId === route.id);
    if (assigned.length === 0) return null;
    let slowestCap = Number.POSITIVE_INFINITY;
    for (const aircraft of assigned) {
      const model = getAircraftById(aircraft.modelId);
      if (!model) continue;
      const legs = legTicksFor(route.distanceKm, model.speedKmh, model.turnaroundTimeMinutes);
      slowestCap = Math.min(
        slowestCap,
        maxWeeklyFrequency(legs.durationTicks, legs.turnaroundTicks, assigned.length),
      );
    }
    return Number.isFinite(slowestCap) ? slowestCap : null;
  }, [fleet, route.id, route.distanceKm]);

  const upperBound = Math.min(
    MAX_ROUTE_FREQUENCY_PER_WEEK,
    physicalMax ?? MAX_ROUTE_FREQUENCY_PER_WEEK,
  );
  const flown = physicalMax === null ? 0 : Math.min(value, physicalMax);
  const legsPerDay = (flown * 2) / 7;
  const changing = draft !== null && draft !== current;
  const timing = useMemo(
    () =>
      changing
        ? scheduleChangeTiming(
            route,
            { frequencyPerWeek: draft ?? current },
            minuteTick,
            lastJoinTickOn(route.assignedAircraftIds, new Map(fleet.map((ac) => [ac.id, ac]))),
          )
        : null,
    [changing, current, draft, fleet, minuteTick, route],
  );
  const step = (delta: number) =>
    setDraft(Math.min(upperBound, Math.max(MIN_ROUTE_FREQUENCY_PER_WEEK, value + delta)));

  const apply = async () => {
    if (draft === null || draft === current) return;
    setSaving(true);
    try {
      await updateRouteFrequency(route.id, draft);
      setDraft(null);
    } catch (error) {
      toast.error(t("routeManager.frequency.failed", { ns: "game" }), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col" data-testid="route-frequency">
      <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
        {t("routeManager.frequency.label", { ns: "game" })}
      </span>
      <div className="mt-1 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={saving || value <= MIN_ROUTE_FREQUENCY_PER_WEEK}
          aria-label={t("routeManager.frequency.decrease", { ns: "game" })}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="min-w-[3.5rem] text-center font-mono text-sm font-bold" aria-live="polite">
          {t("routeManager.frequency.perWeek", { ns: "game", count: value })}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={saving || value >= upperBound}
          aria-label={t("routeManager.frequency.increase", { ns: "game" })}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {changing ? (
          <button
            type="button"
            onClick={apply}
            disabled={saving}
            className="ml-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            {timing?.when === "tomorrow"
              ? t("timetable.announce", { ns: "game" })
              : t("routeManager.frequency.apply", { ns: "game" })}
          </button>
        ) : null}
      </div>
      {timing ? <TimetableHint timing={timing} /> : null}
      <span className="mt-1 text-[11px] text-muted-foreground">
        {physicalMax === null
          ? t("routeManager.frequency.noAircraft", { ns: "game" })
          : t("routeManager.frequency.detail", {
              ns: "game",
              legs: legsPerDay.toFixed(1),
              max: physicalMax,
            })}
      </span>
      <RouteUtilization route={route} hideFlyMore={changing} />
      {physicalMax !== null ? (
        <button
          type="button"
          aria-expanded={whatIf}
          data-testid="what-if-toggle"
          onClick={() => setWhatIf((open) => !open)}
          className="mt-1 self-start text-[11px] font-bold text-primary underline-offset-2 hover:underline"
        >
          {whatIf ? t("whatIf.hide", { ns: "game" }) : t("whatIf.frequency", { ns: "game" })}
        </button>
      ) : null}
      {whatIf && curve ? (
        <WhatIfCurve
          testId="frequency-curve"
          curve={curve}
          formatX={(x) => t("routeManager.frequency.perWeek", { ns: "game", count: x })}
          onPick={(x) => setDraft(Math.min(upperBound, Math.max(MIN_ROUTE_FREQUENCY_PER_WEEK, x)))}
          pickBestLabel={(x) => t("whatIf.tryBest", { ns: "game", x })}
        />
      ) : null}
    </div>
  );
}
