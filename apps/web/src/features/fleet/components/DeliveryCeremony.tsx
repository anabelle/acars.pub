import type { AircraftInstance } from "@acars/core";
import { getAircraftById } from "@acars/data";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalPortal } from "@/shared/components/ModalPortal";
import { isCatchupBatch } from "@/shared/lib/catchupBatch";
import { navigateToAircraft } from "@/shared/lib/permalinkNavigation";
import { modelLabel } from "@/shared/theme/livery";
import { Sign } from "@/shared/ui/ramp";
import { type Delivery, findDeliveries } from "../utils/deliveries";
import { AircraftLiveryImage } from "./AircraftLiveryImage";
import { LiveryFallback } from "./LiveryFallback";

/**
 * Delivery day (S61): when a plane arrives live, it gets a ceremony — the
 * water salute over its painting, its name on a sign, and a bigger welcome
 * for the first of its type. Catch-up after time away stays quiet (the away
 * report covers it). Subscribes outside render, like MilestoneCelebrations.
 */
export function DeliveryCeremony() {
  const [queue, setQueue] = useState<Delivery[]>([]);
  const airlineId = useRef<string | null>(null);

  useEffect(() => {
    airlineId.current = useAirlineStore.getState().airline?.id ?? null;
    return useAirlineStore.subscribe((state, prev) => {
      if (state.fleet === prev.fleet) return;
      const id = state.airline?.id ?? null;
      if (id !== airlineId.current) {
        airlineId.current = id;
        return;
      }
      const quiet =
        Boolean(useEngineStore.getState().catchupProgress) ||
        isCatchupBatch(prev.airline?.lastTick, state.airline?.lastTick);
      if (quiet) return;
      const arrivals = findDeliveries(prev.fleet, state.fleet);
      if (arrivals.length > 0) setQueue((current) => [...current, ...arrivals]);
    });
  }, []);

  const current = queue[0];
  const aircraft = useAirlineStore((s) =>
    current ? s.fleet.find((a) => a.id === current.aircraftId) : undefined,
  );
  if (!current || !aircraft) return null;
  return (
    <CeremonyDialog
      key={current.aircraftId}
      aircraft={aircraft}
      firstOfType={current.firstOfType}
      onClose={() => setQueue((q) => q.slice(1))}
    />
  );
}

function CeremonyDialog({
  aircraft,
  firstOfType,
  onClose,
}: {
  aircraft: AircraftInstance;
  firstOfType: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("game");
  const airline = useAirlineStore((s) => s.airline);
  const route = useAirlineStore((s) =>
    aircraft.assignedRouteId ? s.routes.find((r) => r.id === aircraft.assignedRouteId) : undefined,
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const model = getAircraftById(aircraft.modelId);
  const type = model ? modelLabel(model.manufacturer, model.name) : aircraft.modelId;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/80"
          onClick={onClose}
          aria-label={t("delivery.close")}
          tabIndex={-1}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-title"
          data-testid="delivery-ceremony"
          data-first-of-type={firstOfType}
          className="ramp-slab relative z-10 w-full max-w-md overflow-hidden text-ramp-paint"
        >
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-cockpit-panel">
            {model ? (
              <AircraftLiveryImage
                aircraft={aircraft}
                airline={airline}
                model={model}
                isOwner
                fallback={
                  <LiveryFallback
                    familyId={model.familyId}
                    primary={airline?.livery?.primary}
                    secondary={airline?.livery?.secondary}
                  />
                }
              />
            ) : null}
            <WaterSalute />
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-nd-white hover:bg-black/90"
              aria-label={t("delivery.close")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col items-start gap-3 p-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ramp-paint/75">
              {firstOfType
                ? t("delivery.firstOfType", { type })
                : t("delivery.kicker", { airport: aircraft.baseAirportIata })}
            </span>
            <h2 id="delivery-title" className="max-w-full">
              <Sign variant="location" className="max-w-full text-xl">
                <span className="block truncate">{aircraft.name}</span>
              </Sign>
            </h2>
            <p className="text-sm leading-relaxed text-ramp-paint/90">
              {route
                ? t("delivery.firstFlight", {
                    name: aircraft.name,
                    origin: route.originIata,
                    destination: route.destinationIata,
                  })
                : t("delivery.waiting", { name: aircraft.name, airport: aircraft.baseAirportIata })}
            </p>
            <div className="flex w-full flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigateToAircraft(aircraft.id);
                }}
                className="min-h-10 rounded-[3px] bg-sign-yellow px-3 font-sign text-sm font-extrabold uppercase tracking-[0.06em] text-sign-black"
              >
                {t("delivery.open", { name: aircraft.name })} ▶
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-10 rounded-[3px] border border-ramp-paint/30 px-3 text-sm font-bold text-ramp-paint hover:bg-white/5"
              >
                {t("delivery.continue")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

/**
 * Two fire-truck arcs crossing over the plane: the airport's welcome for a
 * new aircraft. Drawn once; with reduced motion they simply stand still.
 */
function WaterSalute() {
  return (
    <svg
      data-testid="water-salute"
      aria-hidden="true"
      viewBox="0 0 160 90"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {["M -4 92 Q 60 -18 124 92", "M 164 92 Q 100 -18 36 92"].map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="rgb(var(--nd-cyan))"
          strokeOpacity="0.55"
          strokeWidth="1.6"
          strokeDasharray="2 2.5"
          strokeLinecap="round"
          className="motion-safe:animate-[water-arc_1.6s_ease-out_both]"
        />
      ))}
    </svg>
  );
}
