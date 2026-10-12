import type { AircraftInstance } from "@acars/core";
import { TICKS_PER_DAY, TICKS_PER_HOUR } from "@acars/core";
import { useEngineStore } from "@acars/store";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LineBoard } from "./LineBoard";
import { LineBuilder } from "./LineBuilder";

/**
 * The plane's day plan in its panel (S66): its line of flying on a 24-hour
 * board with now marked, or an invitation to plan one; opens the builder.
 */
export function LineSection({ aircraft }: { aircraft: AircraftInstance }) {
  const { t } = useTranslation("game");
  const [open, setOpen] = useState(false);
  const minute = useEngineStore((s) => Math.floor(s.tick / (TICKS_PER_HOUR / 60)));
  const legs = aircraft.line?.legs ?? [];
  const block = legs.reduce((sum, leg) => sum + leg.durationTicks, 0) / TICKS_PER_HOUR;
  return (
    <section data-testid="line-section" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t("line.sectionTitle")}
        </h4>
        {legs.length ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            {t("line.summary", { count: legs.length, hours: block.toFixed(1) })}
          </span>
        ) : null}
      </div>
      {legs.length ? (
        <>
          <p className="font-mono text-sm text-foreground" data-testid="line-route">
            {[legs[0].originIata, ...legs.map((leg) => leg.destinationIata)].join("→")}
          </p>
          <LineBoard
            legs={legs}
            nowOffsetTicks={(minute * (TICKS_PER_HOUR / 60)) % TICKS_PER_DAY}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("line.none")}</p>
      )}
      <button
        type="button"
        data-testid="line-open"
        onClick={() => setOpen(true)}
        className="min-h-10 rounded-[3px] bg-sign-yellow px-3 font-sign text-sm font-extrabold uppercase tracking-[0.06em] text-sign-black"
      >
        {legs.length ? t("line.edit") : t("line.plan")} ▶
      </button>
      {open ? <LineBuilder aircraft={aircraft} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
