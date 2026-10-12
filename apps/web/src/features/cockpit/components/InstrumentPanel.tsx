import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { Instrument, InstrumentId, InstrumentState } from "../utils/instruments";

/** Where each gauge's scale starts and ends. */
const SCALE: Record<InstrumentId, { min: number; max: number }> = {
  utilization: { min: 0, max: 16 },
  loadFactor: { min: 0, max: 1 },
  margin: { min: -0.2, max: 0.4 },
  runway: { min: 0, max: 90 },
};

const TONE: Record<InstrumentState, string> = {
  normal: "text-nd-green",
  caution: "text-nd-amber",
  warning: "text-nd-red",
  none: "text-muted-foreground",
};

export interface InstrumentFix {
  label: string;
  run: () => void;
}

function format(id: InstrumentId, value: number | null, t: TFunction<"game">) {
  if (value === null) return "—";
  switch (id) {
    case "utilization":
      return `${value.toFixed(1)} h`;
    case "loadFactor":
    case "margin":
      return `${Math.round(value * 100)}%`;
    case "runway":
      if (!Number.isFinite(value)) return t("instruments.growing");
      return value >= 365
        ? t("instruments.years", { count: Math.floor(value / 365) })
        : t("instruments.days", { count: Math.floor(value) });
  }
}

const position = (id: InstrumentId, value: number) => {
  const { min, max } = SCALE[id];
  const clamped = Math.min(max, Math.max(min, Number.isFinite(value) ? value : max));
  return ((clamped - min) / (max - min)) * 100;
};

/**
 * Four avionics gauges (S62): value, target band, a needle, the trend against
 * the previous 24 h, and a one-tap fix when the needle leaves the band.
 */
export function InstrumentPanel({
  instruments,
  fixes,
}: {
  instruments: readonly Instrument[];
  fixes: Partial<Record<InstrumentId, InstrumentFix>>;
}) {
  const { t } = useTranslation("game");
  return (
    <section
      aria-label={t("instruments.title")}
      data-testid="instrument-panel"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {instruments.map((instrument) => {
        const { id, value, previous, band, state, side } = instrument;
        const fix = state === "caution" || state === "warning" ? fixes[id] : undefined;
        const bandLeft = position(id, band.low);
        const bandRight = position(id, band.high);
        const delta =
          value !== null && previous !== null && Number.isFinite(value) && Number.isFinite(previous)
            ? value - previous
            : null;
        return (
          <div
            key={id}
            data-testid={`instrument-${id}`}
            data-state={state}
            data-side={side ?? ""}
            className="flex flex-col gap-1.5 rounded-[3px] border border-cockpit-line bg-cockpit-bg p-2.5"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {t(`instruments.${id}.label`)}
            </span>
            <span className={cn("font-mono text-xl font-bold leading-none", TONE[state])}>
              {format(id, value, t)}
              {delta !== null && Math.abs(delta) > 1e-6 ? (
                <span
                  className="ml-1.5 text-[11px] font-normal text-muted-foreground"
                  title={t("instruments.trend")}
                >
                  {delta > 0 ? "▲" : "▼"}
                </span>
              ) : null}
            </span>
            <div
              className="relative h-1.5 rounded-[2px] bg-cockpit-line"
              role="img"
              aria-label={t(`instruments.${id}.band`)}
            >
              <span
                className="absolute inset-y-0 rounded-[2px] bg-nd-green/35"
                style={{ left: `${bandLeft}%`, width: `${Math.max(1, bandRight - bandLeft)}%` }}
              />
              {value !== null ? (
                <span
                  className={cn("absolute -top-1 h-3.5 w-0.5 rounded-full bg-current", TONE[state])}
                  style={{ left: `calc(${position(id, value)}% - 1px)` }}
                />
              ) : null}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {value === null ? t("instruments.noData") : t(`instruments.${id}.band`)}
            </span>
            {fix ? (
              <button
                type="button"
                onClick={fix.run}
                data-testid={`instrument-fix-${id}`}
                className="mt-0.5 min-h-8 rounded-[3px] bg-sign-yellow px-2 text-left font-sign text-[11px] font-extrabold uppercase tracking-[0.06em] text-sign-black"
              >
                {fix.label} ▶
              </button>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
