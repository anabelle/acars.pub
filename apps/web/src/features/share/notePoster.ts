import type { NoteDraft } from "@acars/nostr";

/** Where a milestone post goes (injectable for tests). */
export interface NotePoster {
  upload: (image: Blob, fileName: string) => Promise<string>;
  build: (input: { text: string; imageUrl: string | null; link: string }) => Promise<NoteDraft>;
  publish: (note: NoteDraft) => Promise<unknown>;
}

/** Nostr: Blossom for the image, a kind-1 note for the post. Loaded only when posting. */
export const nostrPoster: NotePoster = {
  upload: async (image, fileName) =>
    (await import("@acars/nostr")).uploadToBlossom(image, fileName, "image/png"),
  build: async (input) => (await import("@acars/nostr")).buildMilestoneNote(input),
  publish: async (note) => (await import("@acars/nostr")).publishNote(note),
};
