import type { AircraftInstance } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Route as RouteIcon, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useFerryAndAssign } from "@/features/network/hooks/useFerryAndAssign";
import {
  candidateRoutesForAircraft,
  catalogDistanceKm,
  type RouteCandidate,
} from "@/features/network/utils/assignmentCandidates";
import { ModalPortal } from "@/shared/components/ModalPortal";

const ROW_HEIGHT = 64;

/**
 * "Assign route" for one aircraft (S25): the airline's active routes, ready
 * ones first, with assign or ferry-and-assign.
 */
export function AssignRouteDialog({
  aircraft,
  onClose,
}: {
  aircraft: AircraftInstance;
  onClose: () => void;
}) {
  const { t } = useTranslation("game");
  const routes = useAirlineStore((s) => s.routes);
  const hubs = useAirlineStore((s) => s.airline?.hubs);
  const assignAircraftToRoute = useAirlineStore((s) => s.assignAircraftToRoute);
  const ferryAndAssign = useFerryAndAssign();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const candidates = useMemo(
    () => candidateRoutesForAircraft(aircraft, routes, hubs ?? [], catalogDistanceKm),
    [aircraft, routes, hubs],
  );

  const virtualizer = useVirtualizer({
    count: candidates.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });

  const run = async ({ route, option }: RouteCandidate) => {
    setPendingId(route.id);
    try {
      if (option.kind === "ready") {
        await assignAircraftToRoute(aircraft.id, route.id);
        toast.success(
          t("assign.assigned", {
            aircraft: aircraft.name,
            origin: route.originIata,
            destination: route.destinationIata,
          }),
        );
        onClose();
      } else if (option.kind === "ferry") {
        const sent = await ferryAndAssign(aircraft, route, option.ferryTo, option.ferryKm);
        if (sent) onClose();
      }
    } catch (error) {
      toast.error(t("assign.failed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPendingId(null);
    }
  };

  const describe = ({ route, option }: RouteCandidate) => {
    const km = `${Math.round(route.distanceKm).toLocaleString()} km`;
    if (option.kind === "ready")
      return `${km} · ${t("assign.readyAt", { iata: aircraft.baseAirportIata })}`;
    if (option.kind === "ferry") {
      return t("assign.needsFerry", {
        base: aircraft.baseAirportIata,
        km: option.ferryKm.toLocaleString(),
        to: option.ferryTo,
      });
    }
    return t(`assign.blocked.${option.reason}`, {
      base: aircraft.baseAirportIata,
      origin: route.originIata,
    });
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
          aria-labelledby="assign-route-title"
          data-testid="assign-route-dialog"
          className="relative z-10 flex w-full max-h-[100dvh] flex-col overflow-hidden rounded-t-[24px] border border-border bg-background/95 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl"
        >
          <div className="shrink-0 flex items-start justify-between border-b border-border/50 px-4 py-4 sm:px-6">
            <div>
              <p
                id="assign-route-title"
                className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold"
              >
                {t("assign.routeTitle")}
              </p>
              <h3 className="text-lg font-bold text-foreground">{aircraft.name}</h3>
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
            <p className="px-6 py-8 text-sm text-muted-foreground">{t("assign.noRoutes")}</p>
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
                  const { route, option } = candidate;
                  return (
                    <div
                      key={route.id}
                      data-testid="assign-route-candidate"
                      data-kind={option.kind}
                      className="absolute left-0 top-0 flex w-full items-center gap-3 rounded-xl px-2"
                      style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                    >
                      <RouteIcon
                        className={`h-4 w-4 shrink-0 ${option.kind === "ready" ? "text-emerald-400" : "text-muted-foreground"}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold font-mono text-foreground">
                          {route.originIata} → {route.destinationIata}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {describe(candidate)}
                        </p>
                      </div>
                      {option.kind !== "blocked" ? (
                        <button
                          type="button"
                          disabled={pendingId !== null}
                          onClick={() => run(candidate)}
                          className={
                            option.kind === "ready"
                              ? "shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                              : "shrink-0 rounded-xl border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50"
                          }
                        >
                          {pendingId === route.id
                            ? t("assign.assigning")
                            : option.kind === "ready"
                              ? t("assign.assign")
                              : t("assign.ferryAndAssign")}
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
