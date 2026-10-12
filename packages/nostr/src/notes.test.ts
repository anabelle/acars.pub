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

describe("social posts (S74)", () => {
  it("builds a NIP-68 picture post for a livery reveal", async () => {
    const { buildPictureNote } = await import("./notes.js");
    const note = buildPictureNote({
      title: "Meet Sabana",
      text: " Our new ATR 72-600 is home at MAD. ",
      imageUrl: "https://blossom.primal.net/livery.webp?x=1",
      alt: "ATR 72-600 in E2E Air livery",
      link: "https://acars.pub/airline/npub1x",
    });
    expect(note.kind).toBe(20);
    expect(note.content).toBe(
      "Our new ATR 72-600 is home at MAD.\n\nhttps://acars.pub/airline/npub1x\n\n#acars #aviation",
    );
    expect(note.tags).toEqual([
      ["title", "Meet Sabana"],
      [
        "imeta",
        "url https://blossom.primal.net/livery.webp?x=1",
        "m image/webp",
        "alt ATR 72-600 in E2E Air livery",
      ],
      ["t", "acars"],
      ["t", "aviation"],
      ["r", "https://acars.pub/airline/npub1x"],
    ]);
    const jpeg = buildPictureNote({
      title: "",
      text: "",
      imageUrl: "https://x/a.JPG",
      alt: "",
      link: "l",
    });
    expect(jpeg.tags[1][2]).toBe("m image/jpeg");
    const unknown = buildPictureNote({
      title: "",
      text: "",
      imageUrl: "https://x/a",
      alt: "",
      link: "l",
    });
    expect(unknown.tags[1][2]).toBe("m image/png");
  });

  it("builds a rivalry note and publishes pictures as kind 20", async () => {
    const { buildRivalryNote } = await import("./notes.js");
    const note = buildRivalryNote({ text: "E2E Air enters Barcelona", link: "https://x" });
    expect(note.content).toBe("E2E Air enters Barcelona\n\nhttps://x\n\n#acars #aviation");
    await publishNote({ kind: 20, content: "pic", tags: [] });
    expect(mock.state.published.at(-1)?.kind).toBe(20);
  });
});
