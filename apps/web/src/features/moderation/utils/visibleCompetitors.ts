import type { AircraftInstance, AirlineEntity, Route } from "@acars/core";

export function filterVisibleCompetitors(
  competitors: Map<string, AirlineEntity>,
  mutedPubkeys: ReadonlySet<string>,
): Map<string, AirlineEntity> {
  if (mutedPubkeys.size === 0) return competitors;

  const visible = new Map<string, AirlineEntity>();
  competitors.forEach((value, key) => {
    if (!mutedPubkeys.has(value.ceoPubkey) && !mutedPubkeys.has(key)) {
      visible.set(key, value);
    }
  });
  return visible;
}

export function buildVisibleCompetitorFleet(
  fleetByOwner: Map<string, AircraftInstance[]>,
  playerPubkey: string | null,
  mutedPubkeys: ReadonlySet<string>,
): AircraftInstance[] {
  const result: AircraftInstance[] = [];

  fleetByOwner.forEach((ownerFleet, key) => {
    if (key === playerPubkey || mutedPubkeys.has(key)) return;
    result.push(...ownerFleet);
  });

  return result;
}

export function buildVisibleCompetitorRoutes(
  routesByOwner: Map<string, Route[]>,
  playerPubkey: string | null,
  mutedPubkeys: ReadonlySet<string>,
): Route[] {
  const result: Route[] = [];

  routesByOwner.forEach((ownerRoutes, key) => {
    if (key === playerPubkey || mutedPubkeys.has(key)) return;
    result.push(...ownerRoutes);
  });

  return result;
}
