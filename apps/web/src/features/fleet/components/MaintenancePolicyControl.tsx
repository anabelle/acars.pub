import type { MaintenancePolicy } from "@acars/core";
import { DEFAULT_MAINTENANCE_POLICY } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { ChevronDown, Wrench } from "lucide-react";
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
  const [open, setOpen] = useState(false);

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
    // One line by default (S78): the planes come first; the threshold and hub
    // options open on demand.
    <div
      data-testid="maintenance-policy"
      className="rounded-xl border border-border/50 bg-background/60 px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Wrench className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
        <span
          className="text-sm font-semibold text-foreground"
          title={t("fleet.autoMaintenance.description")}
        >
          {t("fleet.autoMaintenance.title")}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={policy.enabled}
          aria-label={t("fleet.autoMaintenance.title")}
          disabled={saving}
          onClick={() => save({ ...policy, enabled: !policy.enabled })}
          className={`rounded-full px-3 py-1 font-bold transition-colors disabled:opacity-50 ${
            policy.enabled
              ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
              : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
          }`}
        >
          {policy.enabled ? t("fleet.autoMaintenance.on") : t("fleet.autoMaintenance.off")}
        </button>
        {policy.enabled ? (
          <span className="text-muted-foreground">
            {t("fleet.autoMaintenance.summary", { pct: Math.round(policy.minCondition * 100) })}
          </span>
        ) : null}
        <button
          type="button"
          aria-expanded={open}
          data-testid="maintenance-policy-settings"
          onClick={() => setOpen((value) => !value)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          {t("fleet.autoMaintenance.settings")}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>
      {open ? (
        <div className="mt-2 flex flex-col gap-2 border-t border-border/40 pt-2 text-xs">
          <p className="text-muted-foreground">{t("fleet.autoMaintenance.description")}</p>
          <div className="flex flex-wrap items-center gap-3">
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
      ) : null}
    </div>
  );
}
