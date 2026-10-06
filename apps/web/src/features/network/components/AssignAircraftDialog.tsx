import type { Route } from "@acars/core";
import { getAircraftById } from "@acars/data";
import { useAirlineStore } from "@acars/store";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plane, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  type AircraftCandidate,
  type AssignmentOption,
  candidateAircraftForRoute,
  catalogDistanceKm,
} from "@/features/network/utils/assignmentCandidates";
import { ModalPortal } from "@/shared/components/ModalPortal";

const ROW_HEIGHT = 64;

/**
 * "Add aircraft" for one route (S25): every aircraft in the fleet, ready ones
 * first, with a one-tap assign for those already at a hub endpoint.
 */
export function AssignAircraftDialog({ route, onClose }: { route: Route; onClose: () => void }) {
  const { t } = useTranslation("game");
  const fleet = useAirlineStore((s) => s.fleet);
  const hubs = useAirlineStore((s) => s.airline?.hubs);
  const assignAircraftToRoute = useAirlineStore((s) => s.assignAircraftToRoute);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const candidates = useMemo(
    () => candidateAircraftForRoute(route, fleet, hubs ?? [], catalogDistanceKm),
    [route, fleet, hubs],
  );

  const virtualizer = useVirtualizer({
    count: candidates.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });

  const assign = async (candidate: AircraftCandidate) => {
    setPendingId(candidate.aircraft.id);
    try {
      await assignAircraftToRoute(candidate.aircraft.id, route.id);
      toast.success(
        t("assign.assigned", {
          aircraft: candidate.aircraft.name,
          origin: route.originIata,
          destination: route.destinationIata,
        }),
      );
      onClose();
    } catch (error) {
      toast.error(t("assign.failed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPendingId(null);
    }
  };

  const describe = (candidate: AircraftCandidate, option: AssignmentOption) => {
    const base = candidate.aircraft.baseAirportIata;
    if (option.kind === "ready") return t("assign.readyAt", { iata: base });
    if (option.kind === "ferry") {
      return t("assign.needsFerry", {
        base,
        km: option.ferryKm.toLocaleString(),
        to: option.ferryTo,
      });
    }
    return t(`assign.blocked.${option.reason}`, { base, origin: route.originIata });
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => !pendingId && onClose()}
          aria-label={t("assign.closeAria")}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-aircraft-title"
          data-testid="assign-aircraft-dialog"
          className="relative z-10 flex w-full max-h-[100dvh] flex-col overflow-hidden rounded-t-[24px] border border-border bg-background/95 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl"
        >
          <div className="shrink-0 flex items-start justify-between border-b border-border/50 px-4 py-4 sm:px-6">
            <div>
              <p
                id="assign-aircraft-title"
                className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold"
              >
                {t("assign.title")}
              </p>
              <h3 className="text-lg font-bold text-foreground">
                {route.originIata} <span className="text-muted-foreground">→</span>{" "}
                {route.destinationIata}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => !pendingId && onClose()}
              className="rounded-full bg-background/60 p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t("assign.closeAria")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {candidates.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">{t("assign.empty")}</p>
          ) : (
            <div
              ref={scrollRef}
              className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-4"
            >
              <div
                className="relative w-full"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualizer.getVirtualItems().map((item) => {
                  const candidate = candidates[item.index];
                  const { aircraft, option } = candidate;
                  const model = getAircraftById(aircraft.modelId);
                  return (
                    <div
                      key={aircraft.id}
                      data-testid="assign-candidate"
                      data-kind={option.kind}
                      className="absolute left-0 top-0 flex w-full items-center gap-3 rounded-xl px-2"
                      style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                    >
                      <Plane
                        className={`h-4 w-4 shrink-0 ${option.kind === "ready" ? "text-emerald-400" : "text-muted-foreground"}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {aircraft.name}{" "}
                          {model && !aircraft.name.startsWith(model.name) ? (
                            <span className="font-normal text-muted-foreground">{model.name}</span>
                          ) : null}
                        </p>
                        <p
                          className={`truncate text-xs ${option.kind === "blocked" ? "text-muted-foreground/70" : "text-muted-foreground"}`}
                        >
                          {describe(candidate, option)}
                          {option.kind !== "blocked" && option.reassignsFrom
                            ? ` · ${t("assign.reassigns")}`
                            : ""}
                        </p>
                      </div>
                      {option.kind === "ready" ? (
                        <button
                          type="button"
                          disabled={pendingId !== null}
                          onClick={() => assign(candidate)}
                          className="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {pendingId === aircraft.id ? t("assign.assigning") : t("assign.assign")}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
