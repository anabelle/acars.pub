import type { AircraftInstance } from "@acars/core";
import { TICKS_PER_HOUR } from "@acars/core";
import { getAircraftById } from "@acars/data";
import { type LineLegRequest, useAirlineStore } from "@acars/store";
import { Minus, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ModalPortal } from "@/shared/components/ModalPortal";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { cn } from "@/shared/lib/utils";
import {
  autoFillLine,
  defaultDeparture,
  draftFromLine,
  formatOffset,
  nextLegOptions,
  planLine,
} from "../utils/linePlan";
import { LineBoard } from "./LineBoard";

const STEP = 15 * (TICKS_PER_HOUR / 60);
const DAY = 24 * TICKS_PER_HOUR;

/**
 * Plan a plane's day (S66): legs in order from where it is parked, each
 * with a departure time in 15-minute steps; auto-fill for a quick start.
 * Checked live exactly as the replay will check it; saved as one action.
 */
export function LineBuilder({
  aircraft,
  onClose,
}: {
  aircraft: AircraftInstance;
  onClose: () => void;
}) {
  const { t } = useTranslation("game");
  const routes = useAirlineStore((s) => s.routes);
  const setAircraftLine = useAirlineStore((s) => s.setAircraftLine);
  const model = getAircraftById(aircraft.modelId);
  const start = aircraft.line?.legs[0]?.originIata ?? aircraft.baseAirportIata;
  const [draft, setDraft] = useState<LineLegRequest[]>(() =>
    draftFromLine(aircraft.line?.legs ?? [], routes),
  );
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useDialogFocus(closeRef, onClose);

  if (!model) return null;
  const plan = planLine(draft, routes, model, start);
  const lastLeg = plan.legs[plan.legs.length - 1];
  const end = lastLeg?.destinationIata ?? start;
  const options = nextLegOptions(end, routes, model);

  const addLeg = (value: string) => {
    const option = options.find((o) => `${o.routeId}:${o.direction}` === value);
    if (!option) return;
    setDraft((legs) => [
      ...legs,
      {
        routeId: option.routeId,
        direction: option.direction,
        departOffsetTicks: defaultDeparture(lastLeg),
      },
    ]);
  };
  const shift = (index: number, delta: number) =>
    setDraft((legs) =>
      legs.map((leg, i) =>
        i === index
          ? {
              ...leg,
              departOffsetTicks: Math.min(DAY - STEP, Math.max(0, leg.departOffsetTicks + delta)),
            }
          : leg,
      ),
    );
  const save = async (legs: LineLegRequest[]) => {
    setSaving(true);
    try {
      const error = await setAircraftLine(aircraft.id, legs);
      if (error)
        toast.error(t("line.failed"), {
          description: t(`line.error.${error}`, { defaultValue: error }),
        });
      else onClose();
    } finally {
      setSaving(false);
    }
  };
  const flying = aircraft.status === "enroute";

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("line.close")}
          className="absolute inset-0 bg-black/80"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="line-title"
          data-testid="line-builder"
          className="relative z-10 flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[16px] border border-cockpit-line bg-cockpit-panel sm:max-h-[88vh] sm:max-w-xl sm:rounded-[6px]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-cockpit-line px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {t("line.kicker", { name: aircraft.name })}
              </p>
              <h3 id="line-title" className="text-lg font-bold text-foreground">
                {t("line.title", { airport: start })}
              </h3>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t("line.close")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <LineBoard legs={plan.legs} />
            {plan.legs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("line.empty", { airport: start })}</p>
            ) : (
              <ol className="space-y-1.5" data-testid="line-legs">
                {plan.legs.map((leg, index) => (
                  <li
                    key={`${leg.routeId}-${index}`}
                    className="flex items-center gap-2 rounded-[3px] border border-cockpit-line bg-cockpit-bg px-2 py-1.5"
                  >
                    <span className="w-12 font-mono text-sm font-bold text-foreground">
                      {formatOffset(leg.departOffsetTicks)}
                    </span>
                    <span className="flex-1 font-mono text-sm">
                      {leg.originIata}→{leg.destinationIata}
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {formatOffset(leg.durationTicks).replace(/^0/, "")} h
                      </span>
                      {index > 0 ? (
                        <span
                          className={cn(
                            "ml-2 text-[11px]",
                            plan.buffers[index - 1] < 0
                              ? "text-nd-red"
                              : plan.buffers[index - 1] < 20 * (TICKS_PER_HOUR / 60)
                                ? "text-nd-amber"
                                : "text-nd-green",
                          )}
                        >
                          {t("line.buffer", {
                            minutes: Math.round(plan.buffers[index - 1] / (TICKS_PER_HOUR / 60)),
                          })}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => shift(index, -STEP)}
                      aria-label={t("line.earlier")}
                      className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-cockpit-line hover:bg-white/5"
                    >
                      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => shift(index, STEP)}
                      aria-label={t("line.later")}
                      className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-cockpit-line hover:bg-white/5"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    {index === plan.legs.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setDraft((legs) => legs.slice(0, -1))}
                        aria-label={t("line.remove")}
                        className="flex h-8 w-8 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-white/5"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="w-8" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ol>
            )}

            {options.length > 0 ? (
              <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {t("line.addFrom", { airport: end })}
                <select
                  data-testid="line-add"
                  value=""
                  onChange={(event) => addLeg(event.target.value)}
                  className="min-h-10 rounded-[3px] border border-cockpit-line bg-cockpit-bg px-2 font-mono text-sm normal-case tracking-normal text-foreground"
                >
                  <option value="">{t("line.choose")}</option>
                  {options.map((option) => (
                    <option
                      key={`${option.routeId}:${option.direction}`}
                      value={`${option.routeId}:${option.direction}`}
                    >
                      {end}→{option.destinationIata} ·{" "}
                      {formatOffset(option.durationTicks).replace(/^0/, "")} h
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("line.noRoutes", { airport: end })}
              </p>
            )}

            <p
              data-testid="line-status"
              className={cn("text-sm", plan.error ? "text-nd-amber" : "text-nd-green")}
            >
              {plan.legs.length === 0
                ? t("line.hint")
                : plan.error
                  ? t(`line.error.${plan.error}`, { airport: start })
                  : t("line.ok", {
                      airport: start,
                      time: formatOffset(
                        (lastLeg?.departOffsetTicks ?? 0) + (lastLeg?.durationTicks ?? 0),
                      ),
                      hours: (plan.blockTicks / TICKS_PER_HOUR).toFixed(1),
                    })}
            </p>
            {flying ? (
              <p className="text-sm text-muted-foreground">{t("line.whenLanded")}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-cockpit-line px-4 py-3">
            <button
              type="button"
              data-testid="line-autofill"
              onClick={() => setDraft(autoFillLine(start, routes, model))}
              className="min-h-10 rounded-[3px] border border-cockpit-line px-3 text-sm font-bold text-foreground hover:bg-white/5"
            >
              {t("line.autofill")}
            </button>
            {aircraft.line ? (
              <button
                type="button"
                disabled={saving || flying}
                onClick={() => save([])}
                className="min-h-10 rounded-[3px] border border-cockpit-line px-3 text-sm font-bold text-muted-foreground hover:bg-white/5 disabled:opacity-50"
              >
                {t("line.clear")}
              </button>
            ) : null}
            <button
              type="button"
              data-testid="line-save"
              disabled={saving || flying || plan.legs.length === 0 || plan.error !== null}
              onClick={() => save(draft)}
              className="ml-auto min-h-10 rounded-[3px] bg-sign-yellow px-4 font-sign text-sm font-extrabold uppercase tracking-[0.06em] text-sign-black disabled:opacity-40"
            >
              {t("line.save")} ▶
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
