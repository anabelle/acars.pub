import { ROUTE_PROFIT_COLORS } from "@acars/map";
import { useTranslation } from "react-i18next";

/** Key for the player's route styling on the globe (S41): colour = profit, width = frequency. */
export function RouteLegend() {
  const { t } = useTranslation("game");
  return (
    <div
      className="pointer-events-none absolute bottom-14 right-20 z-20 hidden rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-[10px] text-muted-foreground shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:block"
      data-testid="route-legend"
    >
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
