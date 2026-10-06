import type { MaintenancePolicy } from "@acars/core";
import { DEFAULT_MAINTENANCE_POLICY } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { Wrench } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export const THRESHOLD_OPTIONS = [0.3, 0.4, 0.5, 0.6, 0.7] as const;

/** Fleet-wide auto-maintenance default (S13). */
export function MaintenancePolicyControl() {
  const { t } = useTranslation("game");
  const policy = useAirlineStore((s) => s.airline?.maintenancePolicy) ?? DEFAULT_MAINTENANCE_POLICY;
  const setMaintenancePolicy = useAirlineStore((s) => s.setMaintenancePolicy);
  const [saving, setSaving] = useState(false);

  const save = async (next: MaintenancePolicy) => {
    setSaving(true);
    try {
      await setMaintenancePolicy(next);
    } catch (error) {
      toast.error(t("fleet.autoMaintenance.failed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="maintenance-policy"
      className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t("fleet.autoMaintenance.title")}
          </p>
          <p className="text-xs text-muted-foreground">{t("fleet.autoMaintenance.description")}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          role="switch"
          aria-checked={policy.enabled}
          aria-label={t("fleet.autoMaintenance.title")}
          disabled={saving}
          onClick={() => save({ ...policy, enabled: !policy.enabled })}
          className={`rounded-full px-3 py-1.5 font-bold transition-colors disabled:opacity-50 ${
            policy.enabled
              ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
              : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
          }`}
        >
          {policy.enabled ? t("fleet.autoMaintenance.on") : t("fleet.autoMaintenance.off")}
        </button>
        <label className="flex items-center gap-1.5 text-muted-foreground">
          {t("fleet.autoMaintenance.thresholdLabel")}
          <select
            value={policy.minCondition}
            disabled={saving}
            onChange={(event) => save({ ...policy, minCondition: Number(event.target.value) })}
            className="rounded-lg border border-border/50 bg-background px-2 py-1 text-foreground"
          >
            {THRESHOLD_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t("fleet.autoMaintenance.thresholdOption", { pct: Math.round(value * 100) })}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input
            type="checkbox"
            checked={policy.hubOnly}
            disabled={saving}
            onChange={(event) => save({ ...policy, hubOnly: event.target.checked })}
            className="accent-primary"
          />
          {t("fleet.autoMaintenance.hubOnly")}
        </label>
      </div>
    </div>
  );
}
