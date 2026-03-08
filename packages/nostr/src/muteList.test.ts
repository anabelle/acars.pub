import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadMuteList, MUTE_LIST_KIND, publishMuteList } from "./muteList.js";

const { MockNDKEvent, ensureConnectedMock, publishMock, subscribeMock } = vi.hoisted(() => {
  const publishMock = vi.fn();
  const subscribeMock = vi.fn();
  const ensureConnectedMock = vi.fn(() => Promise.resolve());

  class MockNDKEvent {
    kind = 0;
    tags: string[][] = [];
    content = "";
    author = { pubkey: "author-pubkey" };
    created_at?: number;

    constructor() {}

    async publish() {
      await publishMock(this);
    }
  }

  return { MockNDKEvent, ensureConnectedMock, publishMock, subscribeMock };
});

vi.mock("@nostr-dev-kit/ndk", () => ({
  NDKEvent: MockNDKEvent,
}));

vi.mock("./ndk.js", () => ({
  ensureConnected: () => ensureConnectedMock(),
  getNDK: () => ({
    signer: {},
    subscribe: (...args: unknown[]) => subscribeMock(...args),
  }),
}));

describe("mute list", () => {
  beforeEach(() => {
    publishMock.mockReset();
    subscribeMock.mockReset();
    ensureConnectedMock.mockClear();
  });

  it("publishes a standard kind 10000 mute list with unique pubkeys", async () => {
    await publishMuteList(["comp-1", "comp-2", "comp-1", "", "  "]);

    expect(ensureConnectedMock).toHaveBeenCalled();
    expect(publishMock).toHaveBeenCalledTimes(1);

    const event = publishMock.mock.calls[0][0] as MockNDKEvent;
    expect(event.kind).toBe(MUTE_LIST_KIND);
    expect(event.tags).toEqual([
      ["p", "comp-1"],
      ["p", "comp-2"],
    ]);
    expect(event.content).toBe("");
  });

  it("loads the latest mute list for an author", async () => {
    subscribeMock.mockImplementation(() => {
      const handlers = new Map<string, (event?: unknown) => void>();
      queueMicrotask(() => {
        handlers.get("event")?.({
          kind: MUTE_LIST_KIND,
          author: { pubkey: "player-pubkey" },
          created_at: 10,
          tags: [["p", "comp-1"]],
        });
        handlers.get("event")?.({
          kind: MUTE_LIST_KIND,
          author: { pubkey: "someone-else" },
          created_at: 11,
          tags: [["p", "ignored"]],
        });
        handlers.get("event")?.({
          kind: MUTE_LIST_KIND,
          author: { pubkey: "player-pubkey" },
          created_at: 12,
          tags: [
            ["p", "comp-2"],
            ["p", "comp-2"],
            ["word", "ignored"],
          ],
        });
        handlers.get("eose")?.();
      });

      return {
        on: (name: string, handler: (event?: unknown) => void) => {
          handlers.set(name, handler);
        },
        stop: vi.fn(),
      };
    });

    await expect(loadMuteList("player-pubkey")).resolves.toEqual(new Set(["comp-2"]));
  });
});
