import { fpFormat, getTierProgress } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { useTranslation } from "react-i18next";

function MiniBar({ pct, met, label }: { pct: number; met: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap" title={label}>
      <span className="relative h-1 w-12 shrink-0 overflow-hidden rounded-full bg-border">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${met ? "bg-emerald-400" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{label}</span>
    </span>
  );
}

/**
 * Compact progress towards the next tier (overhaul S31): cumulative revenue
 * and active routes, the two requirements in `TIER_THRESHOLDS`. Primitive
 * selectors, so it re-renders only when those numbers change.
 */
export function TopbarTierProgress() {
  const { t } = useTranslation("common");
  const tier = useAirlineStore((s) => s.airline?.tier ?? 1);
  const cumulativeRevenue = useAirlineStore((s) => s.airline?.cumulativeRevenue ?? 0);
  const activeRoutes = useAirlineStore(
    (s) => s.routes.filter((route) => route.status === "active").length,
  );
  const progress = getTierProgress(tier, cumulativeRevenue as never, activeRoutes);

  if (progress.nextTier === null) {
    return (
      <span className="mt-1 font-mono text-sm font-bold text-foreground" data-testid="topbar-tier">
        {t("topbar.tierLabel", { tier })}{" "}
        <span className="text-muted-foreground">· {t("topbar.tierMax")}</span>
      </span>
    );
  }

  return (
    <span
      className="mt-1 flex flex-col gap-0.5 md:items-end"
      data-testid="topbar-tier"
      title={t("topbar.tierTitle", {
        next: progress.nextTier,
        revenue: fpFormat(progress.revenueTarget ?? (0 as never), 0),
        routes: progress.routesTarget,
      })}
    >
      <span className="font-mono text-sm font-bold text-foreground">
        {t("topbar.tierLabel", { tier })}{" "}
        <span className="text-muted-foreground">→ {progress.nextTier}</span>
      </span>
      <span className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
        <MiniBar
          pct={progress.revenuePct}
          met={progress.revenueMet}
          label={t("topbar.tierRevenue", { pct: progress.revenuePct })}
        />
        <MiniBar
          pct={progress.routesPct}
          met={progress.routesMet}
          label={t("topbar.tierRoutes", { pct: progress.routesPct })}
        />
      </span>
    </span>
  );
}
