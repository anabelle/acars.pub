import type { Route } from "@acars/core";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useRouteUtilization } from "../hooks/useRouteUtilization";

type Props = {
  route: Route | undefined;
  /** Hide the "fly more" button (e.g. while the player edits the frequency). */
  hideFlyMore?: boolean;
};

/** Block hours a day per plane, an idle warning and one-tap "fly more" (S58). */
export function RouteUtilization({ route, hideFlyMore = false }: Props) {
  const { t } = useTranslation(["game"]);
  const { blockHours, idle, suggestedFrequency, flyMore, saving } = useRouteUtilization(route);
  if (blockHours === null) return null;

  const onFlyMore = async () => {
    try {
      await flyMore();
    } catch (error) {
      toast.error(t("routeManager.frequency.failed", { ns: "game" }), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="flex flex-col gap-1.5" data-testid="route-utilization">
      <span
        className={`text-[11px] ${idle ? "font-bold text-amber-400" : "text-muted-foreground"}`}
        data-testid="route-block-hours"
      >
        {t("routeManager.frequency.blockHours", { ns: "game", hours: blockHours.toFixed(1) })}
        {idle ? ` · ${t("routeManager.frequency.idle", { ns: "game" })}` : ""}
      </span>
      {!hideFlyMore && suggestedFrequency !== null ? (
        <button
          type="button"
          onClick={onFlyMore}
          disabled={saving}
          data-testid="route-fly-more"
          className="min-h-9 self-start rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-60"
        >
          {t("routeManager.frequency.flyMore", { ns: "game", count: suggestedFrequency })}
        </button>
      ) : null}
    </div>
  );
}
