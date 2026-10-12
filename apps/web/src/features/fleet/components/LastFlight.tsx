import type { AircraftInstance, TimelineEvent } from "@acars/core";
import { fpFormat } from "@acars/core";
import { useTranslation } from "react-i18next";
import { formatUtcClock } from "@/features/network/utils/tickerFacts";
import { cn } from "@/shared/lib/utils";
import { type CabinClass, cabinRows, landingReceipt, passengerVoice } from "../utils/cabin";

const CLASS_COLOUR: Record<CabinClass, string> = {
  first: "bg-nd-magenta",
  business: "bg-nd-cyan",
  economy: "bg-ramp-paint",
};

/** A seat letter and row from the event id, for the voice's signature. */
function seatFor(id: string): string {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `${(h % 28) + 3}${"ABCDEF"[h % 6]}`;
}

/**
 * The plane's last landing (S63): its cabin by class, seat by seat, and the
 * receipt — tickets, every cost line, the net — with a passenger's word now
 * and then. Drawn from the landing's own counts; nobody is simulated.
 */
export function LastFlight({
  aircraft,
  landing,
}: {
  aircraft: AircraftInstance;
  landing: TimelineEvent;
}) {
  const { t } = useTranslation("game");
  const pax = landing.details?.passengers ?? {
    economy: Math.round((aircraft.lastKnownLoadFactor ?? 0) * aircraft.configuration.economy),
    business: 0,
    first: 0,
    total: 0,
  };
  const { rows, seatsPerGlyph } = cabinRows(aircraft.configuration, pax);
  const seats = rows.reduce((sum, row) => sum + row.seats, 0);
  const filled = rows.reduce((sum, row) => sum + row.filled, 0);
  const receipt = landingReceipt(landing);
  const voice = passengerVoice(landing);

  return (
    <section data-testid="last-flight" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t("lastFlight.title")}
        </h4>
        <span className="font-mono text-[11px] text-muted-foreground">
          {landing.originIata} → {landing.destinationIata} · {formatUtcClock(landing.tick)}Z
        </span>
      </div>

      <div
        data-testid="cabin-strip"
        role="img"
        aria-label={t("lastFlight.cabinAria", { filled, seats })}
        className="space-y-1.5 rounded-[3px] border border-cockpit-line bg-cockpit-bg p-2.5"
      >
        {rows.map((row) => (
          <div key={row.cls} className="flex items-center gap-2">
            <span className="w-6 shrink-0 font-mono text-[10px] font-bold text-muted-foreground">
              {t(`lastFlight.class.${row.cls}`)}
            </span>
            <span className="flex flex-wrap gap-[2px]">
              {Array.from({ length: row.glyphs }, (_, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: seats are fixed positions.
                  key={i}
                  data-filled={i < row.filledGlyphs}
                  className={cn(
                    "h-2.5 w-2 rounded-[1px]",
                    i < row.filledGlyphs ? CLASS_COLOUR[row.cls] : "bg-cockpit-line",
                  )}
                />
              ))}
            </span>
          </div>
        ))}
        <p className="pt-1 font-mono text-[11px] text-muted-foreground">
          {t("lastFlight.aboard", { filled, seats, empty: seats - filled })}
          {seatsPerGlyph > 1 ? ` · ${t("lastFlight.perGlyph", { count: seatsPerGlyph })}` : ""}
        </p>
      </div>

      {receipt ? (
        <div
          data-testid="landing-receipt"
          className="rounded-[3px] bg-ramp-paint px-3 py-2.5 font-mono text-[11px] text-sign-black"
        >
          <p className="mb-1.5 text-center font-bold uppercase tracking-[0.2em]">
            {t("lastFlight.receipt")}
          </p>
          {[
            ...receipt.income.map((l) => ({ ...l, sign: 1 })),
            ...receipt.costs.map((l) => ({ ...l, sign: -1 })),
          ].map((line) => (
            <p key={`${line.sign}-${line.key}`} className="flex items-baseline gap-1">
              <span>{t(`lastFlight.line.${line.key}`)}</span>
              <span
                aria-hidden="true"
                className="flex-1 border-b border-dotted border-sign-black/40"
              />
              <span>
                {line.sign < 0 ? "−" : ""}
                {fpFormat(line.amount, 0)}
              </span>
            </p>
          ))}
          <p className="mt-1.5 flex items-baseline gap-1 border-t border-dashed border-sign-black/60 pt-1.5 font-bold">
            <span>{t("lastFlight.net")}</span>
            <span aria-hidden="true" className="flex-1" />
            <span className={receipt.net < 0 ? "text-sign-red" : undefined}>
              {fpFormat(receipt.net, 0)}
            </span>
          </p>
          {voice ? (
            <p
              data-testid="passenger-voice"
              className="mt-2 border-t border-dashed border-sign-black/30 pt-2 italic"
            >
              “{t(`lastFlight.voice.${voice}`)}” —{" "}
              {t("lastFlight.seat", { seat: seatFor(landing.id) })}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
