import { powBits, RANKED_POW_BITS } from "@acars/core";
import { getEventHash, verifyEvent } from "nostr-tools/pure";

/**
 * Rank proofs (S72, D15): one addressable event per player whose id carries
 * NIP-13 proof of work. Signed, so nobody can claim someone else's work, and
 * kept apart from the (self-reported) action log and snapshots. Pure helpers.
 */

export const RANK_KIND = 30078;
/** Same world as the action log (schema.ts WORLD_ID). */
export const RANK_WORLD_ID = "v6-beta";
export const RANK_D_TAG = `airtr:world:${RANK_WORLD_ID}:rank`;
export const RANK_CONTENT = "ranked";

export interface RankTemplate {
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
}

/** The unsigned proof before mining (nonce 0, committing to `bits`). */
export function rankTemplate(pubkey: string, createdAtSec: number, bits = RANKED_POW_BITS) {
  return {
    kind: RANK_KIND,
    pubkey,
    created_at: createdAtSec,
    tags: [
      ["d", RANK_D_TAG],
      ["nonce", "0", String(bits)],
    ],
    content: RANK_CONTENT,
  } satisfies RankTemplate;
}

export interface MineOptions {
  bits?: number;
  /** Hashes between yields to the UI. */
  chunk?: number;
  onProgress?: (hashes: number) => void;
  signal?: AbortSignal;
}

/**
 * Find a nonce that gives the template's id `bits` leading zero bits. Yields
 * to the event loop every `chunk` hashes so the page stays responsive;
 * rejects with an AbortError when `signal` aborts.
 */
export async function mineRankProof(
  template: RankTemplate,
  { bits = RANKED_POW_BITS, chunk = 4000, onProgress, signal }: MineOptions = {},
): Promise<RankTemplate & { id: string }> {
  const event = { ...template, tags: template.tags.map((tag) => [...tag]) };
  const nonceTag = event.tags.find((tag) => tag[0] === "nonce");
  if (!nonceTag) throw new Error("rank template has no nonce tag");
  nonceTag[2] = String(bits);
  let nonce = 0;
  for (;;) {
    for (let i = 0; i < chunk; i++, nonce++) {
      nonceTag[1] = String(nonce);
      const id = getEventHash(event);
      if (powBits(id) >= bits) return { ...event, id };
    }
    onProgress?.(nonce);
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (signal?.aborted) throw new DOMException("Mining cancelled", "AbortError");
  }
}

/**
 * The pubkey a rank proof ranks, or null: the right kind and d-tag, a valid
 * signature (id and sig), and at least `bits` of work both committed to in
 * the nonce tag and present in the id.
 */
export function parseRankProof(
  event: {
    id?: string;
    sig?: string;
    kind?: number;
    pubkey?: string;
    created_at?: number;
    tags?: string[][];
    content?: string;
  },
  bits = RANKED_POW_BITS,
): string | null {
  if (event.kind !== RANK_KIND || !event.id || !event.sig || !event.pubkey) return null;
  const tags = event.tags ?? [];
  if (!tags.some((tag) => tag[0] === "d" && tag[1] === RANK_D_TAG)) return null;
  const nonce = tags.find((tag) => tag[0] === "nonce");
  if (!nonce || !(Number(nonce[2]) >= bits)) return null;
  if (powBits(event.id) < bits) return null;
  try {
    if (!verifyEvent(event as Parameters<typeof verifyEvent>[0])) return null;
  } catch {
    return null;
  }
  return event.pubkey;
}
