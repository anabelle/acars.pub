import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { ensureConnected, getNDK } from "./ndk.js";

/**
 * Who a player follows (S74, NIP-02): the `p` tags of their newest contact
 * list (kind 3). Empty when they have none or the relays don't answer.
 */
export async function loadFollows(pubkey: string): Promise<Set<string>> {
  const follows = new Set<string>();
  if (!/^[0-9a-f]{64}$/.test(pubkey)) return follows;
  await ensureConnected();
  const ndk = getNDK();
  let newest: { created_at: number; tags: string[][] } | null = null;
  await new Promise<void>((resolve) => {
    const sub = ndk.subscribe({ kinds: [3], authors: [pubkey], limit: 1 }, { closeOnEose: true });
    const timeout = setTimeout(() => {
      sub.stop();
      resolve();
    }, 6000);
    sub.on("event", (event: NDKEvent) => {
      const raw = event.rawEvent();
      if (raw.pubkey !== pubkey || raw.kind !== 3) return;
      if (!newest || raw.created_at > newest.created_at) newest = raw;
    });
    sub.on("eose", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  for (const tag of (newest as { tags: string[][] } | null)?.tags ?? []) {
    if (tag[0] === "p" && /^[0-9a-f]{64}$/.test(tag[1] ?? "")) follows.add(tag[1]);
  }
  return follows;
}
