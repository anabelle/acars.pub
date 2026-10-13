import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { WorkspaceContextBar } from "./WorkspaceContextBar";

const state = vi.hoisted(() => ({
  airline: null as { status: string } | null,
  pubkey: "me" as string | null,
  viewedPubkey: null as string | null,
  identityStatus: "ready",
}));

vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (s: typeof state) => unknown) => selector(state),
}));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: "/fleet" } }),
}));

afterEach(() => {
  cleanup();
  state.airline = null;
  state.viewedPubkey = null;
  state.identityStatus = "ready";
});

describe("WorkspaceContextBar (S78)", () => {
  it("stays out of the way on the player's own airline", () => {
    state.airline = { status: "private" };
    const { container } = render(<WorkspaceContextBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says so when the player is looking at a rival's airline", () => {
    state.airline = { status: "private" };
    state.viewedPubkey = "rival";
    render(<WorkspaceContextBar />);
    expect(screen.getByText("Viewing a rival")).toBeInTheDocument();
  });

  it("says so for a guest", () => {
    state.identityStatus = "guest";
    render(<WorkspaceContextBar />);
    expect(screen.getByText("Browsing as a guest")).toBeInTheDocument();
  });
});
