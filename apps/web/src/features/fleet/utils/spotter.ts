import type { AircraftInstance, AircraftModel } from "@acars/core";

export type SpotterState = "owned" | "next" | "locked";

export interface SpotterEntry {
  model: AircraftModel;
  state: SpotterState;
  /** Planes of this type in the fleet (deliveries included). */
  count: number;
}

const ORDER: Record<SpotterState, number> = { owned: 0, next: 1, locked: 2 };

/**
 * The spotter's book (S61): every catalog type as owned, next (unlocked at
 * the airline's tier) or locked; owned first, then by tier and size.
 */
export function spotterEntries(
  catalog: readonly AircraftModel[],
  fleet: readonly Pick<AircraftInstance, "modelId">[],
  tier: number,
): { entries: SpotterEntry[]; owned: number; total: number } {
  const counts = new Map<string, number>();
  for (const aircraft of fleet)
    counts.set(aircraft.modelId, (counts.get(aircraft.modelId) ?? 0) + 1);
  const entries = catalog.map((model): SpotterEntry => {
    const count = counts.get(model.id) ?? 0;
    const state: SpotterState = count > 0 ? "owned" : model.unlockTier <= tier ? "next" : "locked";
    return { model, state, count };
  });
  entries.sort(
    (a, b) =>
      ORDER[a.state] - ORDER[b.state] ||
      a.model.unlockTier - b.model.unlockTier ||
      a.model.capacity.economy +
        a.model.capacity.business +
        a.model.capacity.first -
        (b.model.capacity.economy + b.model.capacity.business + b.model.capacity.first) ||
      a.model.id.localeCompare(b.model.id),
  );
  const owned = entries.filter((entry) => entry.state === "owned").length;
  return { entries, owned, total: catalog.length };
}
