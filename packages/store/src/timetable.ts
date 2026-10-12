import type { AircraftInstance } from "@acars/core";

/**
 * The latest tick a plane joined a route (S69): a frequency rise within an
 * hour of it flies at once (new capacity); other changes wait for tomorrow.
 */
export function lastJoinTickOn(
  aircraftIds: readonly string[],
  fleet: Pick<ReadonlyMap<string, Pick<AircraftInstance, "routeAssignedAtTick">>, "get">,
): number | undefined {
  let latest: number | undefined;
  for (const id of aircraftIds) {
    const joined = fleet.get(id)?.routeAssignedAtTick;
    if (joined !== undefined && (latest === undefined || joined > latest)) latest = joined;
  }
  return latest;
}
