import { economyElasticity, PASSENGER_GROUPS } from "@acars/core";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { destinationMix } from "@/features/network/utils/passengerGroups";

/**
 * Who flies a route (S71): the passenger groups travelling to its
 * destination and what that means for fares — holiday routes punish a fare
 * rise, business routes forgive it.
 */
export function WhoFlies({ destinationIata }: { destinationIata: string }) {
  const { t } = useTranslation("game");
  const mix = destinationMix(destinationIata);
  const elasticity = economyElasticity(mix);
  const tone = elasticity <= -1.3 ? "sensitive" : elasticity >= -1.0 ? "forgiving" : "balanced";
  const groups = PASSENGER_GROUPS.filter((group) => mix[group] > 0)
    .map((group) => t(`groups.share.${group}`, { percent: Math.round(mix[group] * 100) }))
    .join(" · ");
  return (
    <p
      data-testid="who-flies"
      data-tone={tone}
      className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground"
    >
      <Users className="h-3 w-3" aria-hidden="true" />
      <span>{t("groups.whoFlies", { groups })}</span>
      <span
        className={
          tone === "sensitive"
            ? "font-semibold text-amber-300"
            : tone === "forgiving"
              ? "font-semibold text-emerald-300"
              : "font-semibold text-slate-300"
        }
      >
        {t(`groups.tone.${tone}`)}
      </span>
    </p>
  );
}
