import type { NDKKind } from "@nostr-dev-kit/ndk";
import { NDKEvent, type NDKFilter } from "@nostr-dev-kit/ndk";
import { ensureConnected, getNDK } from "./ndk.js";

export const MUTE_LIST_KIND: NDKKind = 10000 as NDKKind;

function parseMuteListTags(tags: string[][]): string[] {
  const muted = new Set<string>();

  for (const tag of tags) {
    if (tag[0] !== "p") continue;
    const pubkey = tag[1]?.trim();
    if (!pubkey) continue;
    muted.add(pubkey);
  }

  return Array.from(muted);
}

export async function publishMuteList(pubkeys: Iterable<string>): Promise<NDKEvent> {
  await ensureConnected();
  const ndk = getNDK();

  if (!ndk.signer) {
    throw new Error("No signer available. Call attachSigner() first.");
  }

  const event = new NDKEvent(ndk);
  event.kind = MUTE_LIST_KIND;
  event.tags = parseMuteListTags(Array.from(pubkeys, (pubkey) => ["p", pubkey])).map((pubkey) => [
    "p",
    pubkey,
  ]);
  event.content = "";

  await event.publish();
  return event;
}

export async function loadMuteList(pubkey: string): Promise<Set<string> | null> {
  await ensureConnected();
  const ndk = getNDK();

  const filter: NDKFilter = {
    kinds: [MUTE_LIST_KIND],
    authors: [pubkey],
    limit: 5,
  };

  let latestTags: string[][] | null = null;
  let latestCreatedAt = -1;

  await new Promise<void>((resolve) => {
    const sub = ndk.subscribe(filter, { closeOnEose: true });
    const timeout = setTimeout(() => {
      sub.stop();
      resolve();
    }, 6000);

    sub.on("event", (event: NDKEvent) => {
      if (event.kind !== MUTE_LIST_KIND) return;
      if (event.author.pubkey !== pubkey) return;
      const createdAt = event.created_at ?? 0;
      if (createdAt < latestCreatedAt) return;
      latestTags = event.tags;
      latestCreatedAt = createdAt;
    });

    sub.on("eose", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  if (!latestTags) return null;
  return new Set(parseMuteListTags(latestTags));
}
