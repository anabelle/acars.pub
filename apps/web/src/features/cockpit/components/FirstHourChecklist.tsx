import type { AircraftInstance, FixedPoint, Route, TimelineEvent } from "@acars/core";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { deriveFirstHourChecklist } from "../utils/firstHourChecklist";

interface FirstHourChecklistProps {
  routes: Route[];
  fleet: AircraftInstance[];
  timeline: TimelineEvent[];
  cumulativeRevenue: FixedPoint;
}

/**
 * The guided first hour (overhaul S31): five steps derived from airline state,
 * the next one highlighted with a link straight to where it is done. Hidden
 * once every step is done.
 */
export function FirstHourChecklist({
  routes,
  fleet,
  timeline,
  cumulativeRevenue,
}: FirstHourChecklistProps) {
  const { t } = useTranslation("game");
  const checklist = useMemo(
    () => deriveFirstHourChecklist({ routes, fleet, timeline, cumulativeRevenue }),
    [routes, fleet, timeline, cumulativeRevenue],
  );
  if (checklist.complete) return null;
  const total = checklist.steps.length;

  return (
    <section
      className="rounded-3xl border border-primary/30 bg-primary/5 p-5 shadow-sm"
      aria-labelledby="first-hour-title"
      data-testid="first-hour-checklist"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {t("cockpit.checklist.kicker")}
          </p>
          <h2 id="first-hour-title" className="mt-1 text-lg font-black tracking-tight">
            {t("cockpit.checklist.title")}
          </h2>
        </div>
        <span className="shrink-0 rounded-full border border-primary/30 px-2.5 py-1 text-xs font-bold text-primary">
          {t("cockpit.checklist.progress", { done: checklist.doneCount, total })}
        </span>
      </div>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={checklist.doneCount}
        aria-label={t("cockpit.checklist.title")}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${(checklist.doneCount / total) * 100}%` }}
        />
      </div>
      <ol className="mt-4 space-y-2">
        {checklist.steps.map((step) => {
          const isNext = checklist.next?.id === step.id;
          return (
            <li
              key={step.id}
              data-testid={`checklist-${step.id}`}
              data-done={step.done}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                isNext ? "border-primary/40 bg-background/80" : "border-transparent",
              )}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Circle
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isNext ? "text-primary" : "text-muted-foreground/50",
                  )}
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    step.done ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {t(`cockpit.checklist.steps.${step.id}.title`)}
                  <span className="sr-only">
                    {" "}
                    {step.done ? t("cockpit.checklist.doneSr") : t("cockpit.checklist.todoSr")}
                  </span>
                </p>
                {isNext && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t(`cockpit.checklist.steps.${step.id}.${step.waiting ? "waiting" : "hint"}`)}
                  </p>
                )}
              </div>
              {isNext && (
                <Link
                  to={step.to}
                  search={step.search}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  {t(`cockpit.checklist.steps.${step.id}.action`)}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
