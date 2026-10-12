import { useAirlineStore, useRankStore } from "@acars/store";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rankedFirst } from "@/features/competition/leaderboardMetrics";
import { GetRanked } from "./GetRanked";
import { RankBridge } from "./RankBridge";

const ME = "a".repeat(64);
const RIVAL = "b".repeat(64);

vi.mock("@acars/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@acars/store")>();
  return { ...actual, getRanked: vi.fn(), cancelRankMining: vi.fn() };
});

beforeEach(() => {
  useRankStore.setState({ ranked: new Set(), loaded: false, status: "unknown", hashes: 0 });
  useAirlineStore.setState({
    pubkey: ME,
    airline: { id: "me", ceoPubkey: ME } as never,
    competitors: new Map([["rival", { ceoPubkey: RIVAL } as never]]),
  });
});
afterEach(cleanup);

describe("GetRanked (S72)", () => {
  it("waits until the player's rank is known", () => {
    render(<GetRanked />);
    expect(screen.queryByTestId("get-ranked")).toBeNull();
  });

  it("offers the work, shows progress and cancel, then the badge", async () => {
    const store = await import("@acars/store");
    useRankStore.setState({ status: "unranked" });
    render(<GetRanked />);
    fireEvent.click(screen.getByRole("button", { name: "Get ranked (a few seconds)" }));
    expect(store.getRanked).toHaveBeenCalledWith(ME);
    act(() => useRankStore.setState({ status: "mining", hashes: 12000 }));
    expect(screen.getByTestId("get-ranked")).toHaveTextContent("Working… 12,000 tries");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(store.cancelRankMining).toHaveBeenCalled();
    act(() => useRankStore.setState({ status: "publishing" }));
    expect(screen.getByTestId("get-ranked")).toHaveTextContent("Publishing your proof");
    act(() => useRankStore.setState({ status: "failed" }));
    expect(screen.getByTestId("get-ranked")).toHaveTextContent("Try again");
    act(() => useRankStore.setState({ status: "ranked" }));
    expect(screen.getByTestId("get-ranked")).toHaveAttribute("data-status", "ranked");
  });
});

describe("RankBridge (S72)", () => {
  it("loads proofs for the player and rivals, again when rivals arrive", async () => {
    const load = vi.fn(async () => new Set([RIVAL]));
    render(<RankBridge load={load} />);
    await vi.waitFor(() => expect(useRankStore.getState().loaded).toBe(true));
    expect(load).toHaveBeenCalledWith([RIVAL, ME]);
    expect(useRankStore.getState().status).toBe("unranked");
    act(() =>
      useAirlineStore.setState({
        competitors: new Map([
          ["rival", { ceoPubkey: RIVAL } as never],
          ["new", { ceoPubkey: "c".repeat(64) } as never],
        ]),
      }),
    );
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it("does nothing without anyone to ask, and survives a failed load", async () => {
    useAirlineStore.setState({ pubkey: null, competitors: new Map() });
    const idle = vi.fn(async () => new Set<string>());
    render(<RankBridge load={idle} />);
    expect(idle).not.toHaveBeenCalled();
    // The key arrives after mount: proofs load then.
    act(() => useAirlineStore.setState({ pubkey: ME }));
    await vi.waitFor(() => expect(idle).toHaveBeenCalledWith([ME]));
    cleanup();
    useRankStore.setState({ ranked: new Set(), loaded: false, status: "unknown", hashes: 0 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing = vi.fn(async () => {
      throw new Error("relays down");
    });
    render(<RankBridge load={failing} />);
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(useRankStore.getState().loaded).toBe(false);
    warn.mockRestore();
  });
});

describe("rankedFirst (S72)", () => {
  it("puts ranked airlines first, keeping each part's order", () => {
    const rows = [
      { ceoPubkey: "u1" },
      { ceoPubkey: "r1" },
      { ceoPubkey: "u2" },
      { ceoPubkey: "r2" },
    ];
    const ranked = (key: string) => key.startsWith("r");
    expect(rankedFirst(rows, ranked).map((r) => r.ceoPubkey)).toEqual(["r1", "r2", "u1", "u2"]);
    expect(rankedFirst(rows, null)).toEqual(rows);
  });
});
