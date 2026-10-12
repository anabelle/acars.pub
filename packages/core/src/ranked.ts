import { getSuggestedFares } from "./finance.js";
import type { FixedPoint, FlightOffer } from "./types.js";

/**
 * Ranked entry (S72, D15 "computer work first"): a ranked airline has done a
 * little proof of work once (NIP-13: leading zero bits of a signed event id).
 * Unranked airlines play, but their fares can't undercut anyone.
 */

/** Leading zero bits a rank proof's id needs: ~260 k hashes, seconds in a browser. */
export const RANKED_POW_BITS = 18;

/** Leading zero bits of a hex id (NIP-13 difficulty); 0 for anything not hex. */
export function powBits(hexId: string): number {
  let bits = 0;
  for (let i = 0; i < hexId.length; i++) {
    const nibble = Number.parseInt(hexId[i], 16);
    if (Number.isNaN(nibble)) return i === 0 ? 0 : bits;
    if (nibble === 0) {
      bits += 4;
      continue;
    }
    return bits + Math.clz32(nibble) - 28;
  }
  return bits;
}

/** True when an event id carries enough work to rank an airline. */
export function isRankedId(hexId: string, bits = RANKED_POW_BITS): boolean {
  return /^[0-9a-f]{64}$/.test(hexId) && powBits(hexId) >= bits;
}

const atLeast = (fare: FixedPoint, floor: FixedPoint): FixedPoint => (fare < floor ? floor : fare);

/**
 * An unranked rival's offer as everyone else's market sees it: fares no
 * lower than the suggested fare for the distance (anti-dumping).
 */
export function unrankedOffer(offer: FlightOffer, distanceKm: number): FlightOffer {
  const floor = getSuggestedFares(distanceKm);
  const next = {
    ...offer,
    fareEconomy: atLeast(offer.fareEconomy, floor.economy),
    fareBusiness: atLeast(offer.fareBusiness, floor.business),
    fareFirst: atLeast(offer.fareFirst, floor.first),
  };
  if (offer.next) {
    next.next = {
      ...offer.next,
      ...(offer.next.fareEconomy !== undefined
        ? { fareEconomy: atLeast(offer.next.fareEconomy, floor.economy) }
        : {}),
      ...(offer.next.fareBusiness !== undefined
        ? { fareBusiness: atLeast(offer.next.fareBusiness, floor.business) }
        : {}),
      ...(offer.next.fareFirst !== undefined
        ? { fareFirst: atLeast(offer.next.fareFirst, floor.first) }
        : {}),
    };
  }
  return next;
}
