import type { NDKEvent, NDKFilter } from "@nostr-dev-kit/ndk";
import { NDKEvent as NDKEventClass } from "@nostr-dev-kit/ndk";
import { ensureConnected, getNDK } from "./ndk.js";
import { parseRankProof, RANK_D_TAG, RANK_KIND, type RankTemplate } from "./rankProof.js";

/** Authors per query: relays cap filter sizes. */
const AUTHORS_PER_QUERY = 200;

/**
 * Which of `pubkeys` hold a valid rank proof (S72). One query per 200
 * authors; anything missing or invalid reads as unranked.
 */
export async function loadRankProofs(pubkeys: readonly string[]): Promise<Set<string>> {
  const ranked = new Set<string>();
  const wanted = [...new Set(pubkeys.filter((key) => /^[0-9a-f]{64}$/.test(key)))];
  if (wanted.length === 0) return ranked;
  await ensureConnected();
  const ndk = getNDK();
  for (let start = 0; start < wanted.length; start += AUTHORS_PER_QUERY) {
    const filter: NDKFilter = {
      kinds: [RANK_KIND],
      authors: wanted.slice(start, start + AUTHORS_PER_QUERY),
      "#d": [RANK_D_TAG],
    };
    await new Promise<void>((resolve) => {
      const sub = ndk.subscribe(filter, { closeOnEose: true });
      const timeout = setTimeout(() => {
        sub.stop();
        resolve();
      }, 6000);
      sub.on("event", (event: NDKEvent) => {
        const pubkey = parseRankProof(event.rawEvent());
        if (pubkey && wanted.includes(pubkey)) ranked.add(pubkey);
      });
      sub.on("eose", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
  return ranked;
}

/**
 * Sign and publish a mined rank proof with the player's signer. Signing keeps
 * the mined fields, so the id (and its work) is unchanged; returns the id.
 */
export async function publishRankProof(mined: RankTemplate): Promise<string> {
  await ensureConnected();
  const ndk = getNDK();
  if (!ndk.signer) throw new Error("No signer available. Call attachSigner() first.");
  const event = new NDKEventClass(ndk, {
    kind: mined.kind,
    created_at: mined.created_at,
    tags: mined.tags,
    content: mined.content,
    pubkey: mined.pubkey,
  });
  await event.sign();
  if (!parseRankProof(event.rawEvent())) throw new Error("rank proof lost its work when signed");
  await event.publish();
  return event.id;
}
