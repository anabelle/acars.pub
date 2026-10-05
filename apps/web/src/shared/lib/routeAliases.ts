/**
 * Friendly URL aliases that match the navigation names (Routes, Rivals,
 * Finance, Info). Each alias redirects to its canonical path so old shared
 * links and new ones both keep working. Search params pass through so
 * `/routes?tab=opportunities` lands on the same tab.
 */
export const ROUTE_ALIASES = {
  "/routes": "/network",
  "/rivals": "/leaderboard",
  "/finance": "/corporate",
  "/info": "/about",
} as const;

export type RouteAlias = keyof typeof ROUTE_ALIASES;

export function resolveRouteAlias<A extends RouteAlias>(
  alias: A,
  search: Record<string, unknown>,
): { to: (typeof ROUTE_ALIASES)[A]; search: Record<string, unknown>; replace: true } {
  return { to: ROUTE_ALIASES[alias], search: { ...search }, replace: true };
}
