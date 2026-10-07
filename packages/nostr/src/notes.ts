import { createLogger } from "@acars/core";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { ensureConnected, getNDK } from "./ndk.js";
import { withPublishRetry } from "./schema.js";

const logger = createLogger("NostrNotes");

/** Hashtags every ACARS post carries, so they can be followed. */
export const NOTE_HASHTAGS = ["acars", "aviation"] as const;

export interface NoteDraft {
  content: string;
  tags: string[][];
}

/**
 * A public text note (NIP-01 kind 1) for a milestone (S51): the player's
 * text, the image (NIP-92 `imeta`, URL in the content so every client shows
 * it), the airline page link and the hashtags. Pure.
 */
export function buildMilestoneNote({
  text,
  imageUrl,
  link,
}: {
  text: string;
  imageUrl: string | null;
  link: string;
}): NoteDraft {
  const hashtags = NOTE_HASHTAGS.map((tag) => `#${tag}`).join(" ");
  const content = [text.trim(), imageUrl, link, hashtags].filter(Boolean).join("\n\n");
  const tags: string[][] = [...NOTE_HASHTAGS.map((tag) => ["t", tag]), ["r", link]];
  if (imageUrl) tags.push(["imeta", `url ${imageUrl}`, "m image/png"]);
  return { content, tags };
}

/** Signs and publishes a kind-1 note. Only ever called after the player confirms. */
export async function publishNote(note: NoteDraft): Promise<NDKEvent> {
  await ensureConnected();
  const ndk = getNDK();
  if (!ndk.signer) {
    throw new Error("No signer available. Call attachSigner() first.");
  }
  const event = new NDKEvent(ndk);
  event.kind = 1;
  event.content = note.content;
  event.tags = note.tags;
  await withPublishRetry(() => event.publish(), { retries: 2, logger });
  return event;
}
