import type { FixedPoint, Route } from "@acars/core";
import { fpToNumber } from "@acars/core";
import type { MapRoute } from "@acars/map";

/**
 * The player's active routes as the globe draws them (S41): weekly frequency
 * for width and measured profit per hour for colour. Routes that haven't
 * landed a flight yet have no profit figure (drawn neutral). O(routes).
 */
export function toMapRoutes(
  routes: readonly Route[],
  performance: ReadonlyArray<{ routeId: string; profitPerHour: FixedPoint }>,
): MapRoute[] {
  const profitById = new Map(performance.map((entry) => [entry.routeId, entry.profitPerHour]));
  const mapRoutes: MapRoute[] = [];
  for (const route of routes) {
    if (route.status !== "active") continue;
    const profit = profitById.get(route.id);
    mapRoutes.push({
      originIata: route.originIata,
      destinationIata: route.destinationIata,
      ownerPubkey: route.airlinePubkey,
      isPlayer: true,
      frequencyPerWeek: route.frequencyPerWeek,
      profitPerHour: profit === undefined ? null : fpToNumber(profit),
    });
  }
  return mapRoutes;
}
