import type { AircraftInstance } from "@acars/core";

export interface Delivery {
  aircraftId: string;
  /** The first plane of this model the airline has received. */
  firstOfType: boolean;
}

/**
 * Planes that left "delivery" between two fleet snapshots (S61), oldest
 * first. A plane is the first of its type when no other plane of the same
 * model had already been delivered.
 */
export function findDeliveries(
  prev: readonly Pick<AircraftInstance, "id" | "status" | "modelId">[],
  next: readonly Pick<AircraftInstance, "id" | "status" | "modelId">[],
): Delivery[] {
  const wasDelivering = new Set(prev.filter((a) => a.status === "delivery").map((a) => a.id));
  const delivered = next.filter((a) => wasDelivering.has(a.id) && a.status !== "delivery");
  if (delivered.length === 0) return [];
  const arrivedIds = new Set(delivered.map((a) => a.id));
  const modelsAlreadyFlying = new Set(
    next.filter((a) => a.status !== "delivery" && !arrivedIds.has(a.id)).map((a) => a.modelId),
  );
  const seen = new Set<string>();
  return delivered.map((aircraft) => {
    const firstOfType = !modelsAlreadyFlying.has(aircraft.modelId) && !seen.has(aircraft.modelId);
    seen.add(aircraft.modelId);
    return { aircraftId: aircraft.id, firstOfType };
  });
}
