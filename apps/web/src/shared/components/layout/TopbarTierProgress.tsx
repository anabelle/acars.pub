import { fpFormat, fpSub, fpToNumber, getTierProgress } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { useTranslation } from "react-i18next";

const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Progress towards the next tier, in words (S78): what still stands in the
 * way — routes first, they are what a player can act on now — instead of two
 * unlabeled micro-bars. The full requirement is in the tooltip. Primitive
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

  const routesLeft = Math.max(0, (progress.routesTarget ?? 0) - activeRoutes);
  const revenueLeft =
    progress.revenueTarget === null
      ? 0
      : Math.max(0, fpToNumber(fpSub(progress.revenueTarget, cumulativeRevenue as never)));
  const next = !progress.routesMet
    ? t("topbar.tierRoutesLeft", { count: routesLeft })
    : !progress.revenueMet
      ? t("topbar.tierRevenueLeft", { amount: compactMoney.format(revenueLeft) })
      : t("topbar.tierReady");

  return (
    <span
      className="mt-1 flex flex-col md:items-end"
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
      <span
        className="text-[10px] font-semibold text-muted-foreground"
        data-testid="topbar-tier-next"
      >
        {next}
      </span>
    </span>
  );
}
