import type { AirlineEntity } from "@acars/core";
import type { NoteDraft } from "@acars/nostr";
import { useAirlineStore } from "@acars/store";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { MilestonePostDialog } from "./MilestonePostDialog";
import type { NotePoster } from "./notePoster";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ME = "a".repeat(64);

const fakePoster = () => {
  const poster = {
    upload: vi.fn<NotePoster["upload"]>(async () => "https://blossom.example/card.png"),
    build: vi.fn<NotePoster["build"]>(async ({ text, imageUrl, link }) => ({
      content: [text, imageUrl, link].filter(Boolean).join("\n"),
      tags: [],
    })),
    publish: vi.fn<(note: NoteDraft) => Promise<unknown>>(async () => ({})),
  };
  return poster;
};

beforeEach(() => {
  // jsdom has no object URLs; browsers do.
  Object.assign(URL, { createObjectURL: () => "blob:preview", revokeObjectURL: () => {} });
  useAirlineStore.setState({
    pubkey: ME,
    airline: {
      id: "air-1",
      name: "Iberia Nova",
      icaoCode: "IBN",
      tier: 2,
      hubs: ["MAD"],
      livery: { primary: "#c8102e", secondary: "#ffffff", accent: "#ffcc00" },
    } as AirlineEntity,
    fleet: [],
    routes: [],
  });
});

afterEach(async () => {
  cleanup();
  toast.success.mockClear();
  toast.error.mockClear();
  await i18n.changeLanguage("en");
});

describe("MilestonePostDialog", () => {
  it("previews the note and posts it, with the image, only on Post", async () => {
    const poster = fakePoster();
    const onClose = vi.fn();
    render(
      <MilestonePostDialog
        milestone={{ kind: "tierUp", tier: 2 }}
        onClose={onClose}
        poster={poster}
      />,
    );
    const text = screen.getByLabelText("Your post") as HTMLTextAreaElement;
    expect(text.value).toBe("Iberia Nova just reached tier 2 on ACARS ✈️");
    await waitFor(() => expect(screen.getByTestId("milestone-post-image")).toBeInTheDocument(), {
      timeout: 10_000,
    });
    expect(poster.publish).not.toHaveBeenCalled();

    fireEvent.change(text, { target: { value: "Tier 2, baby" } });
    fireEvent.click(screen.getByRole("button", { name: "Post to Nostr" }));
    await waitFor(() => expect(poster.publish).toHaveBeenCalledTimes(1));
    expect(poster.upload).toHaveBeenCalledWith(expect.any(Blob), "acars-ibn-network.png");
    expect(poster.build).toHaveBeenCalledWith({
      text: "Tier 2, baby",
      imageUrl: "https://blossom.example/card.png",
      link: expect.stringMatching(/\/airline\/npub1/),
    });
    expect(toast.success).toHaveBeenCalledWith("Posted to Nostr");
    expect(onClose).toHaveBeenCalled();
  });

  it("can post without the image, and reports failures", async () => {
    const poster = fakePoster();
    poster.publish.mockRejectedValueOnce(new Error("no relays"));
    render(
      <MilestonePostDialog
        milestone={{ kind: "firstJet", model: "A320neo" }}
        onClose={() => {}}
        poster={poster}
      />,
    );
    expect((screen.getByLabelText("Your post") as HTMLTextAreaElement).value).toBe(
      "Iberia Nova took delivery of its first jet, a A320neo ✈️",
    );
    fireEvent.click(screen.getByLabelText("Include the network image"));
    fireEvent.click(screen.getByRole("button", { name: "Post to Nostr" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't post", { description: "no relays" }),
    );
    expect(poster.upload).not.toHaveBeenCalled();
    expect(poster.build).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: null }));
  });

  it("speaks Spanish", async () => {
    await i18n.changeLanguage("es");
    render(
      <MilestonePostDialog
        milestone={{ kind: "tierUp", tier: 3 }}
        onClose={() => {}}
        poster={fakePoster()}
      />,
    );
    expect((screen.getByLabelText("Tu publicación") as HTMLTextAreaElement).value).toBe(
      "Iberia Nova acaba de alcanzar el nivel 3 en ACARS ✈️",
    );
    expect(screen.getByRole("button", { name: "Publicar en Nostr" })).toBeInTheDocument();
  });
});
