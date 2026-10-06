import type { AircraftInstance, AircraftModel, MaintenancePolicy, Route } from "@acars/core";
import { effectiveMaintenancePolicy } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { estimateNextService, flightHoursPerDay } from "@/features/fleet/utils/nextService";

type Choice = "inherit" | "on" | "off";

/**
 * Per-aircraft auto-maintenance override and its next-service estimate (S13).
 * Read-only (estimate only) when viewing another airline.
 */
export function AircraftMaintenanceRow({
  aircraft,
  model,
  route,
  fleetPolicy: airlinePolicy,
  readOnly = false,
}: {
  aircraft: AircraftInstance;
  model: AircraftModel;
  route: Route | null;
  /** The displayed airline's fleet default. */
  fleetPolicy?: MaintenancePolicy;
  readOnly?: boolean;
}) {
  const { t } = useTranslation("game");
  const setMaintenancePolicy = useAirlineStore((s) => s.setMaintenancePolicy);
  const [saving, setSaving] = useState(false);

  const policy = effectiveMaintenancePolicy(aircraft, { maintenancePolicy: airlinePolicy });
  const choice: Choice = aircraft.maintenancePolicy
    ? aircraft.maintenancePolicy.enabled
      ? "on"
      : "off"
    : "inherit";
  const estimate = estimateNextService(aircraft, policy, flightHoursPerDay(model, route));

  const change = async (next: Choice) => {
    const fleet = airlinePolicy ?? policy;
    setSaving(true);
    try {
      await setMaintenancePolicy(
        next === "inherit" ? null : { ...fleet, enabled: next === "on" },
        aircraft.id,
      );
    } catch (error) {
      toast.error(t("fleet.autoMaintenance.failed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  let estimateText: string | null = null;
  if (estimate) {
    if (estimate.kind === "service") {
      estimateText =
        estimate.days === 0
          ? t("fleet.autoMaintenance.dueNow")
          : t("fleet.autoMaintenance.nextService", { count: estimate.days });
    } else {
      estimateText =
        estimate.days === 0
          ? t("fleet.autoMaintenance.groundsNow")
          : t("fleet.autoMaintenance.groundsIn", { count: estimate.days });
    }
  }

  return (
    <div
      className="col-span-2 flex flex-wrap items-center justify-between gap-2"
      data-testid="aircraft-maintenance"
    >
      {readOnly ? null : (
        <label className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-muted-foreground">
          {t("fleet.autoMaintenance.aircraftLabel")}
          <select
            value={choice}
            disabled={saving}
            onChange={(event) => change(event.target.value as Choice)}
            className="rounded-md border border-border/50 bg-background px-1.5 py-0.5 text-[11px] normal-case font-normal text-foreground"
          >
            <option value="inherit">
              {airlinePolicy?.enabled
                ? t("fleet.autoMaintenance.inheritOn")
                : t("fleet.autoMaintenance.inheritOff")}
            </option>
            <option value="on">{t("fleet.autoMaintenance.alwaysOn")}</option>
            <option value="off">{t("fleet.autoMaintenance.alwaysOff")}</option>
          </select>
        </label>
      )}
      {estimateText ? (
        <span
          className={`text-[11px] ${estimate?.kind === "grounding" ? "text-amber-300" : "text-muted-foreground"}`}
        >
          {estimateText}
        </span>
      ) : null}
    </div>
  );
}
