import { useAirlineStore } from "@acars/store";

export interface NavBadges {
  fleetTotal: number;
  fleetUnassigned: number;
  networkTotal: number;
  networkUnassigned: number;
  /** 1-based rank position by corporate balance; 0 if unknown */
  leaderboardRank: number;
}

/**
 * Derives badge counts for nav items from the airline store.
 *
 * Each badge is selected as a PRIMITIVE inside the zustand selector, so the
 * subscribing shell components only re-render when a displayed count actually
 * changes — not on every per-tick state identity churn. Selector cost is
 * O(F + R + C) per store notification (a few times per tick), which is far
 * cheaper than re-rendering the nav DOM. Rank is computed by counting
 * strictly-greater balances (O(C)) instead of sorting the leaderboard.
 */
export function useNavBadges(): NavBadges {
  const fleetTotal = useAirlineStore((s) => (s.airline ? s.fleet.length : 0));
  const fleetUnassigned = useAirlineStore((s) =>
    s.airline
      ? s.fleet.reduce(
          (n, ac) => n + (ac.status === "idle" && ac.assignedRouteId === null ? 1 : 0),
          0,
        )
      : 0,
  );
  const networkTotal = useAirlineStore((s) => (s.airline ? s.routes.length : 0));
  const networkUnassigned = useAirlineStore((s) =>
    s.airline
      ? s.routes.reduce(
          (n, r) => n + (r.status === "active" && r.assignedAircraftIds.length === 0 ? 1 : 0),
          0,
        )
      : 0,
  );
  const leaderboardRank = useAirlineStore((s) => {
    const me = s.airline;
    if (!me) return 0;
    let rank = 1;
    for (const comp of s.competitors.values()) {
      if (comp.corporateBalance > me.corporateBalance) rank += 1;
    }
    return rank;
  });

  return { fleetTotal, fleetUnassigned, networkTotal, networkUnassigned, leaderboardRank };
}
