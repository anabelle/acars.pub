import { useAirlineStore } from "@acars/store";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { AnnounceEntry } from "./AnnounceEntry";
import { RIVALRY_POSTS_PER_DAY, recordRivalryPost, rivalryPostsLeft } from "./rivalryLimit";
import { SocialPostDialog } from "./SocialPostDialog";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const published = vi.hoisted(() => [] as unknown[]);
vi.mock("@acars/nostr", () => ({
  buildRivalryNote: ({ text, link }: { text: string; link: string }) => ({
    kind: 1,
    content: `${text} ${link}`,
    tags: [],
  }),
}));
vi.mock("./notePoster", () => ({
  nostrPoster: {
    publish: async (note: unknown) => {
      published.push(note);
    },
  },
}));

const ME = "a".repeat(64);

beforeEach(() => {
  localStorage.clear();
  published.length = 0;
  act(() =>
    useAirlineStore.setState({ pubkey: ME, airline: { id: "me", name: "E2E Air" } as never }),
  );
});
afterEach(() => {
  cleanup();
  toast.success.mockClear();
  toast.error.mockClear();
});

describe("SocialPostDialog (S74)", () => {
  it("publishes the edited text with the airline link only when Post is pressed", async () => {
    const build = vi.fn(async (text: string, link: string) => ({
      content: `${text}|${link}`,
      tags: [],
    }));
    const publish = vi.fn(async () => {});
    const onPosted = vi.fn();
    const onClose = vi.fn();
    render(
      <SocialPostDialog
        testId="post"
        title="Say it"
        initialText="Hello"
        build={build}
        publish={publish}
        onPosted={onPosted}
        onClose={onClose}
      />,
    );
    expect(publish).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Text"), { target: { value: "Hello world" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(build.mock.calls[0][0]).toBe("Hello world");
    expect(build.mock.calls[0][1]).toContain(`/airline/`);
    expect(publish).toHaveBeenCalledWith({
      content: expect.stringContaining("Hello world|"),
      tags: [],
    });
    expect(onPosted).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Posted to Nostr");
  });

  it("keeps the preview open and says so when posting fails; needs text; needs a key", async () => {
    const onClose = vi.fn();
    render(
      <SocialPostDialog
        testId="post"
        title="Say it"
        initialText=""
        build={async () => ({ content: "", tags: [] })}
        publish={async () => {
          throw new Error("relays down");
        }}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("button", { name: "Post" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Text"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    cleanup();
    act(() => useAirlineStore.setState({ pubkey: null }));
    render(
      <SocialPostDialog
        testId="post"
        title="Say it"
        initialText="x"
        build={async () => ({ content: "", tags: [] })}
        onClose={onClose}
      />,
    );
    expect(screen.queryByTestId("post")).toBeNull();
  });
});

describe("rivalry limit (S74)", () => {
  it("allows three a UTC day, then resets", () => {
    const day = Date.UTC(2026, 9, 12, 10);
    expect(rivalryPostsLeft(day)).toBe(RIVALRY_POSTS_PER_DAY);
    for (let i = 0; i < 4; i++) recordRivalryPost(day);
    expect(rivalryPostsLeft(day)).toBe(0);
    expect(rivalryPostsLeft(day + 24 * 3_600_000)).toBe(3);
    localStorage.setItem("acars_rivalry_posts", "{broken");
    expect(rivalryPostsLeft(day)).toBe(3);
  });
});

describe("AnnounceEntry (S74)", () => {
  const route = { id: "r1", originIata: "MAD", destinationIata: "ZZZ" } as never;

  it("previews the announcement and counts it once posted", async () => {
    render(<AnnounceEntry route={route} />);
    expect(screen.getByTestId("announce-entry")).toHaveTextContent("3 announcements left today");
    fireEvent.click(screen.getByRole("button", { name: "Announce your entry" }));
    expect(screen.getByLabelText("Text")).toHaveValue("E2E Air enters ZZZ: MAD → ZZZ. Your move.");
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await vi.waitFor(() =>
      expect(screen.getByTestId("announce-entry")).toHaveTextContent("2 announcements left today"),
    );
    expect(published).toHaveLength(1);
  });

  it("stops at the daily limit, and needs an airline", () => {
    for (let i = 0; i < 3; i++) recordRivalryPost();
    render(<AnnounceEntry route={route} />);
    expect(screen.getByRole("button", { name: "Announce your entry" })).toBeDisabled();
    expect(screen.getByTestId("announce-entry")).toHaveTextContent("come back tomorrow");
    cleanup();
    act(() => useAirlineStore.setState({ airline: null }));
    render(<AnnounceEntry route={route} />);
    expect(screen.queryByTestId("announce-entry")).toBeNull();
  });
});
