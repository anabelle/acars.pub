import { fpToNumber } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { Newspaper, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DailyObjectivesCard } from "@/features/cockpit/components/DailyObjectivesCard";
import { WorldEventsCard } from "@/features/events/WorldEventsCard";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * The briefing drawer (S45.3): the cockpit's "what matters now" in one
 * scrollable side panel over the globe. It reuses the cockpit's own cards,
 * so the prototype shows real content, not a mock.
 */
export function BriefingDrawer({
  open,
  onToggle,
  planesInAir,
}: {
  open: boolean;
  onToggle: () => void;
  planesInAir: number;
}) {
  const { t } = useTranslation("game");
  const airline = useAirlineStore((s) => s.airline);
  const routes = useAirlineStore((s) => s.routes);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-black/80"
      >
        <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />
        {t("play.briefing.open")}
      </button>
    );
  }

  const activeRoutes = routes.filter((route) => route.status === "active").length;
  return (
    <aside
      data-testid="play-briefing"
      aria-label={t("play.briefing.title")}
      className="pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-white/10 bg-black/80 text-white backdrop-blur-xl"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Newspaper className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("play.briefing.title")}
        </h2>
        <button
          type="button"
          onClick={onToggle}
          aria-label={t("play.briefing.close")}
          className="rounded-full p-1.5 text-white/60 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {airline && (
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/5 p-2">
              <dt className="text-[10px] uppercase tracking-widest text-white/50">
                {t("play.briefing.cash")}
              </dt>
              <dd className="font-mono text-sm font-bold">
                {money.format(Math.round(fpToNumber(airline.corporateBalance)))}
              </dd>
            </div>
            <div className="rounded-xl bg-white/5 p-2">
              <dt className="text-[10px] uppercase tracking-widest text-white/50">
                {t("play.briefing.routes")}
              </dt>
              <dd className="font-mono text-sm font-bold">{activeRoutes}</dd>
            </div>
            <div className="rounded-xl bg-white/5 p-2">
              <dt className="text-[10px] uppercase tracking-widest text-white/50">
                {t("play.briefing.inAir")}
              </dt>
              <dd className="font-mono text-sm font-bold">{planesInAir}</dd>
            </div>
          </dl>
        )}
        <WorldEventsCard routes={routes} />
        {airline && <DailyObjectivesCard ledger={airline.objectives} />}
      </div>
    </aside>
  );
}
