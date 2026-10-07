import { GENESIS_TIME, TICK_DURATION } from "@acars/core";
import { History, X } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimeLapse } from "@/features/airline/utils/timeLapse";
import { timeLapseTick } from "@/features/airline/utils/timeLapse";
import { MOBILE_BOTTOM_NAV_BOTTOM_CLASS } from "@/shared/components/layout/mobileLayout";
import { ModalPortal } from "@/shared/components/ModalPortal";

/** The bar's own refresh rate: the clock text and progress, not the planes. */
const BAR_REFRESH_MS = 250;

/**
 * The replay's caption on the map (S55.3): the replayed time, the speed, how
 * many flights have landed so far and a way out. It reads the playback's
 * elapsed time on its own timer, so the map doesn't re-render for it.
 */
export function TimeLapseBar({
  lapse,
  elapsed,
  onClose,
}: {
  lapse: TimeLapse;
  elapsed: RefObject<number>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("game");
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setMs(elapsed.current), BAR_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [elapsed]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const tick = timeLapseTick(lapse, ms);
  let landed = 0;
  for (const leg of lapse.legs) if (leg.arrivalTick <= tick) landed++;
  const progress = lapse.durationMs > 0 ? Math.min(1, ms / lapse.durationMs) : 1;
  const time = new Intl.DateTimeFormat(i18n.language, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(GENESIS_TIME + tick * TICK_DURATION));

  // Portaled: the map lives under the app chrome, the caption must not.
  return (
    <ModalPortal>
      <div
        role="status"
        data-testid="time-lapse-bar"
        data-landed={landed}
        data-total={lapse.legs.length}
        className={`pointer-events-auto fixed left-1/2 z-[80] w-[min(26rem,calc(100%-2rem))] ${MOBILE_BOTTOM_NAV_BOTTOM_CLASS} sm:bottom-14 -translate-x-1/2 rounded-2xl border border-primary/40 bg-background/90 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl`}
      >
        <div className="flex items-center gap-3">
          <History className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
              <span className="font-mono" data-testid="time-lapse-clock">
                {time}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {t("timeLapse.speed", {
                  speed: new Intl.NumberFormat(i18n.language).format(Math.round(lapse.speed)),
                })}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("timeLapse.landed", { landed, total: lapse.legs.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("timeLapse.close")}
            className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/60">
          <div className="h-full bg-primary" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </ModalPortal>
  );
}
