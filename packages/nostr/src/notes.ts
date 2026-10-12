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
  /** 1 (text note, default) or 20 (NIP-68 picture). */
  kind?: 1 | 20;
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

/**
 * A picture post (S74, NIP-68 kind 20) for a delivery: the livery reveal,
 * shown by image-first clients and zappable. `imeta` carries the image; the
 * text, link and hashtags ride in the content. Pure.
 */
export function buildPictureNote({
  title,
  text,
  imageUrl,
  alt,
  link,
}: {
  title: string;
  text: string;
  imageUrl: string;
  alt: string;
  link: string;
}): NoteDraft {
  const hashtags = NOTE_HASHTAGS.map((tag) => `#${tag}`).join(" ");
  return {
    kind: 20,
    content: [text.trim(), link, hashtags].filter(Boolean).join("\n\n"),
    tags: [
      ["title", title],
      ["imeta", `url ${imageUrl}`, `m ${imageMime(imageUrl)}`, `alt ${alt}`],
      ...NOTE_HASHTAGS.map((tag) => ["t", tag]),
      ["r", link],
    ],
  };
}

function imageMime(url: string): string {
  const ext = /\.(png|jpe?g|webp|gif|avif)(?:$|[?#])/i.exec(url)?.[1]?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return ext ? `image/${ext}` : "image/png";
}

/** A rivalry note (S74): "{airline} enters {city}" as a kind 1 note with the airline link. Pure. */
export function buildRivalryNote({ text, link }: { text: string; link: string }): NoteDraft {
  return buildMilestoneNote({ text, imageUrl: null, link });
}

/** Signs and publishes a note (kind 1, or 20 for pictures). Only ever called after the player confirms. */
export async function publishNote(note: NoteDraft): Promise<NDKEvent> {
  await ensureConnected();
  const ndk = getNDK();
  if (!ndk.signer) {
    throw new Error("No signer available. Call attachSigner() first.");
  }
  const event = new NDKEvent(ndk);
  event.kind = note.kind ?? 1;
  event.content = note.content;
  event.tags = note.tags;
  await withPublishRetry(() => event.publish(), { retries: 2, logger });
  return event;
}
