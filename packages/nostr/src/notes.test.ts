import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const state = { published: [] as Array<{ kind: number; content: string; tags: string[][] }> };
  class MockNDKEvent {
    kind = 0;
    content = "";
    tags: string[][] = [];
    async publish() {
      state.published.push({ kind: this.kind, content: this.content, tags: this.tags });
    }
  }
  const ndkMock: { signer: unknown } = { signer: {} };
  return { state, MockNDKEvent, ndkMock };
});

vi.mock("./ndk.js", () => ({
  ensureConnected: vi.fn().mockResolvedValue(undefined),
  getNDK: () => mock.ndkMock,
}));
vi.mock("@nostr-dev-kit/ndk", () => ({
  NDKEvent: mock.MockNDKEvent,
  NDKPublishError: class extends Error {},
}));

import { buildMilestoneNote, publishNote } from "./notes.js";

beforeEach(() => {
  mock.state.published = [];
  mock.ndkMock.signer = {};
});

describe("buildMilestoneNote()", () => {
  it("puts the text, image, link and hashtags in the content and tags", () => {
    const note = buildMilestoneNote({
      text: "  Iberia Nova reached tier 2!  ",
      imageUrl: "https://blossom.primal.net/abc.png",
      link: "https://acars.pub/airline/npub1x",
    });
    expect(note.content).toBe(
      "Iberia Nova reached tier 2!\n\nhttps://blossom.primal.net/abc.png\n\nhttps://acars.pub/airline/npub1x\n\n#acars #aviation",
    );
    expect(note.tags).toEqual([
      ["t", "acars"],
      ["t", "aviation"],
      ["r", "https://acars.pub/airline/npub1x"],
      ["imeta", "url https://blossom.primal.net/abc.png", "m image/png"],
    ]);
  });

  it("works without an image", () => {
    const note = buildMilestoneNote({ text: "Hi", imageUrl: null, link: "https://x" });
    expect(note.content).toBe("Hi\n\nhttps://x\n\n#acars #aviation");
    expect(note.tags.some((tag) => tag[0] === "imeta")).toBe(false);
  });
});

describe("publishNote()", () => {
  it("publishes a kind-1 note", async () => {
    await publishNote({ content: "Hello", tags: [["t", "acars"]] });
    expect(mock.state.published).toEqual([{ kind: 1, content: "Hello", tags: [["t", "acars"]] }]);
  });

  it("needs a signer", async () => {
    mock.ndkMock.signer = undefined;
    await expect(publishNote({ content: "x", tags: [] })).rejects.toThrow("No signer");
  });
});
