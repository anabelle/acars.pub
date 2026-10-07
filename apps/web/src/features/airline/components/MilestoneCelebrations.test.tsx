import type { AirlineEntity, Route } from "@acars/core";
import { fp, getSuggestedFares, TICKS_PER_HOUR } from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { MilestoneCelebrations } from "./MilestoneCelebrations";

const fares = getSuggestedFares(483);
const route = (id: string) =>
  ({
    id,
    distanceKm: 483,
    fareEconomy: fares.economy,
    fareBusiness: fares.business,
    fareFirst: fares.first,
    status: "active",
  }) as Route;
const airline = (patch: Partial<AirlineEntity> = {}) =>
  ({ id: "air-1", tier: 1, lastTick: 1000, cumulativeRevenue: fp(0), ...patch }) as AirlineEntity;

const setAirline = (patch: Partial<AirlineEntity>, routes?: Route[]) =>
  act(() => {
    const state = useAirlineStore.getState();
    useAirlineStore.setState({
      airline: airline({ ...state.airline, ...patch }),
      ...(routes ? { routes } : {}),
    });
  });

beforeEach(() => {
  useEngineStore.setState({ catchupProgress: null });
  useAirlineStore.setState({ airline: airline(), routes: [], fleet: [], timeline: [] });
});

afterEach(() => {
  cleanup();
  toastMock.success.mockReset();
});

describe("MilestoneCelebrations", () => {
  it("toasts a first-hour step completed live", () => {
    render(<MilestoneCelebrations />);
    setAirline({ lastTick: 1001 }, [route("r1")]);
    expect(toastMock.success).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledWith(
      "Milestone reached",
      expect.objectContaining({ description: "Open your first route" }),
    );
    // Nothing new: no second toast.
    setAirline({ lastTick: 1002 });
    expect(toastMock.success).toHaveBeenCalledTimes(1);
  });

  it("does not replay steps already done when the airline loads", () => {
    useAirlineStore.setState({ routes: [route("r1")] });
    render(<MilestoneCelebrations />);
    setAirline({ lastTick: 1001 });
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("celebrates a tier-up that happens live", () => {
    render(<MilestoneCelebrations />);
    setAirline({ lastTick: 1001, tier: 2, cumulativeRevenue: fp(6_000_000) }, [
      route("r1"),
      route("r2"),
      route("r3"),
    ]);
    const dialog = screen.getByTestId("tier-up-dialog");
    expect(dialog).toHaveTextContent("Tier 2 reached!");
    expect(dialog).toHaveTextContent("Routes up to 7,000 km");
    expect(dialog).toHaveTextContent("Up to 3 hubs");
    expect(dialog).toHaveTextContent("Next: Tier 3 at $10,000,000");
    fireEvent.click(screen.getByRole("button", { name: "Keep flying" }));
    expect(screen.queryByTestId("tier-up-dialog")).not.toBeInTheDocument();
  });

  it("stays quiet during a long catch-up and when switching airlines", () => {
    render(<MilestoneCelebrations />);
    setAirline({ lastTick: 1000 + TICKS_PER_HOUR * 3, tier: 2 }, [route("r1")]);
    expect(screen.queryByTestId("tier-up-dialog")).not.toBeInTheDocument();
    expect(toastMock.success).not.toHaveBeenCalled();

    act(() => {
      useAirlineStore.setState({ airline: airline({ id: "air-2", tier: 3, lastTick: 5 }) });
    });
    expect(screen.queryByTestId("tier-up-dialog")).not.toBeInTheDocument();
  });

  it("offers to post a tier-up, opening the composer (S51.2)", () => {
    useAirlineStore.setState({
      pubkey: "a".repeat(64),
      airline: airline({
        name: "Test Air",
        icaoCode: "TST",
        hubs: ["MAD"],
        livery: { primary: "#112233", secondary: "#ffffff", accent: "#ffcc00" },
      }),
    });
    render(<MilestoneCelebrations />);
    setAirline({ lastTick: 1001, tier: 2, cumulativeRevenue: fp(6_000_000) }, [
      route("r1"),
      route("r2"),
      route("r3"),
    ]);
    fireEvent.click(screen.getByTestId("tier-up-share"));
    expect(screen.queryByTestId("tier-up-dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("milestone-post-dialog")).toHaveTextContent("Post to Nostr");
  });

  it("offers to post the first jet with a toast action", () => {
    render(<MilestoneCelebrations />);
    act(() => {
      useAirlineStore.setState({
        airline: airline({ lastTick: 1001 }),
        fleet: [{ id: "ac-1", modelId: "a320neo" } as never],
      });
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      "Your first jet: A320neo",
      expect.objectContaining({ action: expect.objectContaining({ label: "Post it" }) }),
    );
    // A turboprop doesn't count, and a second jet doesn't repeat it.
    toastMock.success.mockClear();
    act(() => {
      useAirlineStore.setState({
        airline: airline({ lastTick: 1002 }),
        fleet: [
          { id: "ac-1", modelId: "a320neo" } as never,
          { id: "ac-2", modelId: "a320neo" } as never,
        ],
      });
    });
    expect(toastMock.success).not.toHaveBeenCalledWith(
      expect.stringContaining("first jet"),
      expect.anything(),
    );
  });
});
