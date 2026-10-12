/**
 * Alliances (S73): an airline names up to three partners in its own log; an
 * alliance is active only when both name each other. Where allies' routes
 * meet, passengers connect across both (codeshares), at a share of what an
 * airline's own connections carry. Pure.
 */

export const MAX_ALLIANCE_PARTNERS = 3;

/** Codeshare connections carry this share of an own-network connection. */
export const CODESHARE_SHARE = 0.7;

const PUBKEY = /^[0-9a-f]{64}$/;

/** Partner pubkeys from an action payload: unique, valid, not oneself, at most three. */
export function parsePartners(value: unknown, self?: string): string[] | null {
  if (!Array.isArray(value)) return null;
  const partners: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !PUBKEY.test(entry) || entry === self) continue;
    if (!partners.includes(entry)) partners.push(entry);
    if (partners.length === MAX_ALLIANCE_PARTNERS) break;
  }
  return partners;
}

export type AllianceStatus = "none" | "proposed" | "invited" | "allied";

/**
 * Between me and another airline: nobody named anybody, I named them
 * (proposed), they named me (invited), or both (allied).
 */
export function allianceStatus(
  mine: readonly string[] | undefined,
  theirs: readonly string[] | undefined,
  myPubkey: string,
  theirPubkey: string,
): AllianceStatus {
  const iNamed = mine?.includes(theirPubkey) ?? false;
  const theyNamed = theirs?.includes(myPubkey) ?? false;
  if (iNamed && theyNamed) return "allied";
  if (iNamed) return "proposed";
  if (theyNamed) return "invited";
  return "none";
}

/** My active allies: the partners I name who name me back. */
export function mutualPartners(
  myPubkey: string,
  mine: readonly string[] | undefined,
  partnersOf: (pubkey: string) => readonly string[] | undefined,
): string[] {
  return (mine ?? []).filter((partner) => partnersOf(partner)?.includes(myPubkey) ?? false);
}
