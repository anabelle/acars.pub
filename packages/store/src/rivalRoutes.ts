import { canonicalRouteKey, type Route } from "@acars/core";

type Pair = Pick<Route, "originIata" | "destinationIata" | "status">;

const activePairs = (routes: readonly Pair[]) => {
  const pairs = new Map<string, Pair>();
  for (const route of routes) {
    if (route.status !== "active") continue;
    pairs.set(canonicalRouteKey(route.originIata, route.destinationIata), route);
  }
  return pairs;
};

/**
 * City pairs a rival has just started flying that the player also flies
 * (either direction), for the "rival on your route" alert (S34). With no
 * earlier snapshot of the rival there is nothing to compare, so no alerts
 * (a first sync would otherwise flag every shared route at once).
 */
export function rivalRoutesNewOnYourPairs(
  playerRoutes: readonly Pair[],
  previousRivalRoutes: readonly Pair[] | undefined,
  rivalRoutes: readonly Pair[],
): Array<{ key: string; originIata: string; destinationIata: string }> {
  if (!previousRivalRoutes) return [];
  const mine = activePairs(playerRoutes);
  const before = activePairs(previousRivalRoutes);
  const found: Array<{ key: string; originIata: string; destinationIata: string }> = [];
  for (const [key, route] of activePairs(rivalRoutes)) {
    if (before.has(key) || !mine.has(key)) continue;
    const own = mine.get(key) ?? route;
    found.push({ key, originIata: own.originIata, destinationIata: own.destinationIata });
  }
  return found;
}
