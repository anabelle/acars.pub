import type { AlertLevel, CockpitAlert } from "./AlertList";

const RANK: Record<AlertLevel, number> = { warning: 0, caution: 1, advisory: 2, normal: 3 };

/** Warnings first, then cautions, advisories and normals; stable within a level. */
export function sortAlerts(alerts: readonly CockpitAlert[]): CockpitAlert[] {
  return alerts
    .map((alert, index) => ({ alert, index }))
    .sort((a, b) => RANK[a.alert.level] - RANK[b.alert.level] || a.index - b.index)
    .map(({ alert }) => alert);
}
