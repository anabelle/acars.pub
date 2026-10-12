import { describeWeather } from "@acars/core";
import { tickHourKey, useEngineStore, useWeatherStore } from "@acars/store";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

/**
 * The airport's weather this hour (S68), from the world's METAR bundle:
 * flight category, storms, fog, snow and gusts, and what it does to
 * departures. Nothing when no bundle reports this airport (calm).
 */
export function AirportWeather({ iata }: { iata: string }) {
  const { t } = useTranslation("game");
  const hour = useEngineStore((s) => tickHourKey(s.tick));
  const factors = useWeatherStore((s) => s.hours.get(hour)?.get(iata));
  if (!factors) return null;
  const rough =
    factors.category >= 2 || factors.thunderstorm || factors.snow || factors.gustKt > 35;
  const tone =
    factors.category === 3 || factors.thunderstorm
      ? "text-nd-red"
      : rough || factors.category === 1
        ? "text-nd-amber"
        : "text-nd-green";
  return (
    <div
      data-testid="airport-weather"
      className="flex flex-col gap-1 rounded-[3px] border border-cockpit-line bg-cockpit-bg px-3 py-2"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {t("weather.title")}
      </span>
      <span className={cn("font-mono text-sm font-bold", tone)}>{describeWeather(factors)}</span>
      <span className="text-[11px] text-muted-foreground">
        {rough
          ? t("weather.delays")
          : factors.category === 1
            ? t("weather.marginal")
            : t("weather.clear")}
      </span>
    </div>
  );
}
