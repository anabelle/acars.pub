import { ROUTE_PROFIT_COLORS } from "@acars/map";
import { useTranslation } from "react-i18next";

interface RouteLegendProps {
  /** Rivals' routes and aircraft visible ("world") or only the player's network. */
  showWorld: boolean;
  onShowWorldChange: (showWorld: boolean) => void;
}

/**
 * Key for the player's route styling on the globe (S41): colour = profit,
 * width = frequency, plus the "my network / world" switch.
 */
export function RouteLegend({ showWorld, onShowWorldChange }: RouteLegendProps) {
  const { t } = useTranslation("game");
  const option = (value: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={showWorld === value}
      onClick={() => onShowWorldChange(value)}
      className={`flex-1 rounded-lg px-2 py-1 font-semibold transition-colors ${
        showWorld === value
          ? "bg-primary/20 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div
      className="pointer-events-auto absolute bottom-14 right-20 z-20 hidden rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-[10px] text-muted-foreground shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:block"
      data-testid="route-legend"
    >
      <div
        className="mb-2 flex w-40 gap-1 rounded-lg border border-border/50 p-0.5"
        role="group"
        aria-label={t("worldMap.legend.viewLabel")}
      >
        {option(false, t("worldMap.legend.myNetwork"))}
        {option(true, t("worldMap.legend.world"))}
      </div>
      <p className="font-semibold uppercase tracking-widest text-foreground">
        {t("worldMap.legend.title")}
      </p>
      <div
        className="mt-1.5 h-1.5 w-40 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${ROUTE_PROFIT_COLORS.loss}, ${ROUTE_PROFIT_COLORS.even}, ${ROUTE_PROFIT_COLORS.profit})`,
        }}
      />
      <div className="mt-1 flex w-40 justify-between">
        <span>{t("worldMap.legend.losing")}</span>
        <span>{t("worldMap.legend.breakEven")}</span>
        <span>{t("worldMap.legend.earning")}</span>
      </div>
      <p className="mt-1">{t("worldMap.legend.width")}</p>
    </div>
  );
}
