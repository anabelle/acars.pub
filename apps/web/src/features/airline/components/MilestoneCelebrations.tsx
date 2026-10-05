import { fpFormat, getMaxHubs, getMaxRouteDistanceKm, getTierProgress } from "@acars/core";
import { type AirlineState, useAirlineStore, useEngineStore } from "@acars/store";
import { PartyPopper, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  type ChecklistStepId,
  deriveFirstHourChecklist,
} from "@/features/cockpit/utils/firstHourChecklist";
import { ModalPortal } from "@/shared/components/ModalPortal";
import i18n from "@/i18n";
import { isCatchupBatch } from "@/shared/lib/catchupBatch";

type Snapshot = Pick<AirlineState, "airline" | "routes" | "fleet" | "timeline">;

const doneSteps = (state: Snapshot): Set<ChecklistStepId> => {
  if (!state.airline) return new Set();
  const checklist = deriveFirstHourChecklist({
    routes: state.routes,
    fleet: state.fleet,
    timeline: state.timeline,
    cumulativeRevenue: state.airline.cumulativeRevenue,
  });
  return new Set(checklist.steps.filter((step) => step.done).map((step) => step.id));
};

/**
 * Milestones as they happen (overhaul S31): a toast when a first-hour step is
 * done, and a celebration when the airline reaches a new tier. Only live
 * changes count: loading the airline or a long catch-up stays quiet (the away
 * report covers those). Subscribes outside render, so the root never
 * re-renders on store writes.
 */
export function MilestoneCelebrations() {
  const [celebratedTier, setCelebratedTier] = useState<number | null>(null);
  const baseline = useRef<{ airlineId: string | null; tier: number; done: Set<ChecklistStepId> }>({
    airlineId: null,
    tier: 0,
    done: new Set(),
  });

  useEffect(() => {
    const reset = (state: Snapshot) => {
      baseline.current = {
        airlineId: state.airline?.id ?? null,
        tier: state.airline?.tier ?? 0,
        done: doneSteps(state),
      };
    };
    reset(useAirlineStore.getState());

    return useAirlineStore.subscribe((state, prev) => {
      if (
        state.airline === prev.airline &&
        state.routes === prev.routes &&
        state.fleet === prev.fleet &&
        state.timeline === prev.timeline
      ) {
        return;
      }
      const airline = state.airline;
      if (!airline || airline.id !== baseline.current.airlineId) {
        reset(state);
        return;
      }
      const quiet =
        Boolean(useEngineStore.getState().catchupProgress) ||
        isCatchupBatch(prev.airline?.lastTick, airline.lastTick);
      const done = doneSteps(state);
      if (!quiet) {
        for (const step of done) {
          if (baseline.current.done.has(step)) continue;
          toast.success(i18n.t("milestones.toastTitle", { ns: "game" }), {
            description: i18n.t(`cockpit.checklist.steps.${step}.title`, { ns: "game" }),
            duration: 5000,
          });
        }
        if (airline.tier > baseline.current.tier) setCelebratedTier(airline.tier);
      }
      baseline.current = { airlineId: airline.id, tier: airline.tier, done };
    });
  }, []);

  if (celebratedTier === null) return null;
  return <TierUpDialog tier={celebratedTier} onClose={() => setCelebratedTier(null)} />;
}

function TierUpDialog({ tier, onClose }: { tier: number; onClose: () => void }) {
  const { t } = useTranslation("game");
  const closeRef = useRef<HTMLButtonElement>(null);
  const cumulativeRevenue = useAirlineStore((s) => s.airline?.cumulativeRevenue ?? 0);
  const activeRoutes = useAirlineStore(
    (s) => s.routes.filter((route) => route.status === "active").length,
  );
  const progress = getTierProgress(tier, cumulativeRevenue as never, activeRoutes);
  const maxKm = getMaxRouteDistanceKm(tier);
  const maxHubs = getMaxHubs(tier);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const unlocks = [
    Number.isFinite(maxKm)
      ? t("milestones.tierUp.range", { km: maxKm.toLocaleString() })
      : t("milestones.tierUp.rangeAny"),
    maxHubs < Number.MAX_SAFE_INTEGER
      ? t("milestones.tierUp.hubs", { count: maxHubs })
      : t("milestones.tierUp.hubsAny"),
  ];

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-label={t("milestones.tierUp.close")}
          tabIndex={-1}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tier-up-title"
          data-testid="tier-up-dialog"
          className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl border border-primary/40 bg-background/95 p-6 text-center shadow-[0_20px_80px_rgba(16,185,129,0.25)]"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={t("milestones.tierUp.close")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary motion-safe:animate-bounce">
            <PartyPopper className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            {t("milestones.tierUp.kicker")}
          </p>
          <h2 id="tier-up-title" className="mt-1 text-2xl font-black tracking-tight">
            {t("milestones.tierUp.title", { tier })}
          </h2>
          <ul className="mt-4 space-y-1.5 text-sm text-foreground">
            {unlocks.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {progress.nextTier !== null && (
            <p className="mt-4 text-xs text-muted-foreground">
              {t("milestones.tierUp.next", {
                next: progress.nextTier,
                revenue: fpFormat(progress.revenueTarget ?? (0 as never), 0),
                routes: progress.routesTarget,
              })}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            {t("milestones.tierUp.continue")}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
