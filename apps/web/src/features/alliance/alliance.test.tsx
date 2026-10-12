import { useAirlineStore } from "@acars/store";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { AllianceControl, AllyBadge } from "./AllianceControl";

const ME = "a".repeat(64);
const THEM = "b".repeat(64);
const setAlliancePartners = vi.fn(async (partners: string[]) => {
  useAirlineStore.setState((s) => ({
    airline: s.airline ? { ...s.airline, alliancePartners: partners } : s.airline,
  }));
  return true;
});

function setup(mine: string[], theirs: string[]) {
  act(() =>
    useAirlineStore.setState({
      pubkey: ME,
      airline: { id: "me", alliancePartners: mine } as never,
      competitors: new Map([[THEM, { alliancePartners: theirs } as never]]),
      setAlliancePartners,
    }),
  );
}

beforeEach(() => setAlliancePartners.mockClear());
afterEach(cleanup);

describe("AllianceControl (S73)", () => {
  it("proposes, then shows it waiting, and can withdraw", async () => {
    setup([], []);
    render(<AllianceControl pubkey={THEM} />);
    const control = screen.getByTestId("alliance-control");
    expect(control).toHaveAttribute("data-status", "none");
    fireEvent.click(screen.getByRole("button", { name: "Propose an alliance" }));
    await vi.waitFor(() => expect(control).toHaveAttribute("data-status", "proposed"));
    expect(setAlliancePartners).toHaveBeenCalledWith([THEM]);
    expect(control).toHaveTextContent("It starts when they accept");
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Withdraw" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await vi.waitFor(() => expect(control).toHaveAttribute("data-status", "none"));
  });

  it("accepts an invitation and can leave the alliance", async () => {
    setup([], [ME]);
    render(<AllianceControl pubkey={THEM} />);
    const control = screen.getByTestId("alliance-control");
    expect(control).toHaveAttribute("data-status", "invited");
    fireEvent.click(screen.getByRole("button", { name: "Accept the alliance" }));
    await vi.waitFor(() => expect(control).toHaveAttribute("data-status", "allied"));
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Leave the alliance" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Leave the alliance" }));
    await vi.waitFor(() => expect(control).toHaveAttribute("data-status", "invited"));
  });

  it("stops at three partners, and hides on your own page or without an airline", () => {
    setup(["c".repeat(64), "d".repeat(64), "e".repeat(64)], []);
    render(<AllianceControl pubkey={THEM} />);
    expect(screen.getByRole("button", { name: "Propose an alliance" })).toBeDisabled();
    expect(screen.getByTestId("alliance-control")).toHaveTextContent("At most 3 partners");
    cleanup();
    render(<AllianceControl pubkey={ME} />);
    expect(screen.queryByTestId("alliance-control")).toBeNull();
    act(() => useAirlineStore.setState({ airline: null }));
    render(<AllianceControl pubkey={THEM} />);
    expect(screen.queryByTestId("alliance-control")).toBeNull();
  });
});

describe("AllyBadge (S73)", () => {
  it("marks allies only", () => {
    setup([THEM], [ME]);
    render(<AllyBadge pubkey={THEM} />);
    expect(screen.getByTestId("ally-badge")).toHaveTextContent("Ally");
    cleanup();
    setup([THEM], []);
    render(<AllyBadge pubkey={THEM} />);
    expect(screen.queryByTestId("ally-badge")).toBeNull();
  });
});
