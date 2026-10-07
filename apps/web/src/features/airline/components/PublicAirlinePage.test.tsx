import { fp } from "@acars/core";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const syncCompetitor = vi.fn<(pubkey: string) => Promise<void>>(async () => {});
const state: Record<string, unknown> = {};
vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ ...state, syncCompetitor }),
}));
vi.mock("@acars/data", () => ({
  isDataCatalogReady: () => true,
  getAircraftById: () => ({ name: "ATR 72-600", familyId: "atr" }),
  getAirports: () => [
    { iata: "MAD", latitude: 40.47, longitude: -3.56 },
    { iata: "BCN", latitude: 41.3, longitude: 2.08 },
  ],
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { PublicAirlinePage } from "./PublicAirlinePage";

const ME = "a".repeat(64);
const RIVAL = "b".repeat(64);
const airline = (name: string) => ({
  name,
  icaoCode: "TST",
  tier: 2,
  hubs: ["MAD"],
  cumulativeRevenue: fp(1_234_567),
  livery: { primary: "#112233", secondary: "#ffffff", accent: "#ffcc00" },
});
const route = { id: "r1", originIata: "MAD", destinationIata: "BCN", status: "active" };
const plane = {
  id: "p1",
  name: "Ship 1",
  modelId: "atr72-600",
  liveryImageUrl: "https://img/1.png",
};

function setState(overrides: Record<string, unknown>) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, {
    pubkey: null,
    airline: null,
    routes: [],
    fleet: [],
    competitors: new Map(),
    routesByOwner: new Map(),
    fleetByOwner: new Map(),
    ...overrides,
  });
}

afterEach(() => {
  cleanup();
  syncCompetitor.mockReset();
  syncCompetitor.mockResolvedValue(undefined);
  toast.success.mockClear();
  toast.error.mockClear();
});

describe("PublicAirlinePage", () => {
  it("shows my own airline without fetching, with stats, map and liveries", () => {
    setState({ pubkey: ME, airline: airline("My Air"), routes: [route], fleet: [plane] });
    render(<PublicAirlinePage pubkey={ME} />);
    expect(screen.getByRole("heading", { name: "My Air" })).toBeInTheDocument();
    expect(screen.getByText("$1,234,567")).toBeInTheDocument();
    expect(screen.getByTestId("airline-route-map").querySelectorAll("line")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "My Air ATR 72-600" })).toHaveAttribute(
      "src",
      "https://img/1.png",
    );
    expect(screen.queryByText("Start your own airline")).toBeNull();
    expect(syncCompetitor).not.toHaveBeenCalled();
  });

  it("shows a rival from the world state, with the sign-up call to action", () => {
    setState({
      competitors: new Map([[RIVAL, airline("Rival Air")]]),
      routesByOwner: new Map([[RIVAL, [route]]]),
      fleetByOwner: new Map([[RIVAL, []]]),
    });
    render(<PublicAirlinePage pubkey={RIVAL} />);
    expect(screen.getByRole("heading", { name: "Rival Air" })).toBeInTheDocument();
    expect(screen.getByText("Start your own airline")).toHaveAttribute("href", "/join");
    expect(screen.queryByText("Fleet")).toBeNull();
  });

  it("looks an unknown airline up, then says when it isn't found", async () => {
    setState({});
    let resolve: () => void = () => {};
    syncCompetitor.mockReturnValueOnce(new Promise<void>((r) => (resolve = r)));
    render(<PublicAirlinePage pubkey={RIVAL} />);
    expect(screen.getByText(/Looking up this airline/)).toBeInTheDocument();
    expect(syncCompetitor).toHaveBeenCalledWith(RIVAL);
    await act(async () => resolve());
    await waitFor(() =>
      expect(screen.getByText("No airline found for this key.")).toBeInTheDocument(),
    );
  });

  it("treats a failed lookup as not found", async () => {
    setState({});
    syncCompetitor.mockRejectedValueOnce(new Error("relays down"));
    render(<PublicAirlinePage pubkey={RIVAL} />);
    await waitFor(() =>
      expect(screen.getByText("No airline found for this key.")).toBeInTheDocument(),
    );
  });

  it("shares your own network: share sheet, or copied link with the image", async () => {
    setState({ pubkey: ME, airline: airline("My Air") });
    const share = vi.fn(async () => {});
    Object.assign(navigator, { share, canShare: undefined });
    const { unmount } = render(<PublicAirlinePage pubkey={ME} />);
    fireEvent.click(screen.getByRole("button", { name: "Share my network" }));
    await waitFor(
      () =>
        expect(share).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "My Air on ACARS",
            url: expect.stringContaining("/airline/"),
          }),
        ),
      { timeout: 10_000 },
    );
    unmount();

    Object.assign(navigator, { share: undefined, clipboard: { writeText: vi.fn(async () => {}) } });
    render(<PublicAirlinePage pubkey={ME} />);
    fireEvent.click(screen.getByRole("button", { name: "Share my network" }));
    await waitFor(
      () =>
        expect(toast.success).toHaveBeenCalledWith(
          "Link copied",
          expect.objectContaining({ action: expect.objectContaining({ label: "Download image" }) }),
        ),
      { timeout: 10_000 },
    );

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share my network" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't share"), {
      timeout: 10_000,
    });
    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});
