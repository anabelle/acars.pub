import type { AirlineEntity, Route } from "@acars/core";
import { mutualPartners } from "@acars/core";

/** Routes of the airline's active allies (S73): partners it names who name it back. */
export function alliedRoutes(state: {
  airline: Pick<AirlineEntity, "alliancePartners"> | null;
  pubkey: string | null;
  competitors: ReadonlyMap<string, Pick<AirlineEntity, "alliancePartners">>;
  routesByOwner: ReadonlyMap<string, readonly Route[]>;
}): Route[] {
  const me = state.pubkey;
  const mine = state.airline?.alliancePartners;
  if (!me || !mine || mine.length === 0) return [];
  return mutualPartners(
    me,
    mine,
    (partner) => state.competitors.get(partner)?.alliancePartners,
  ).flatMap((partner) => state.routesByOwner.get(partner) ?? []);
}
