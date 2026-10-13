import { fp } from "@acars/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import enGame from "@/i18n/locales/en/game.json";
import esGame from "@/i18n/locales/es/game.json";
import { OperationsCockpit } from "./OperationsCockpit";

const relay = vi.hoisted(() => ({ status: "ready" as "ready" | "connecting" | "offline" }));

vi.mock("@/shared/hooks/useRelayHealth", () => ({
  useRelayHealth: () => ({
    status: relay.status,
    relayCount: relay.status === "ready" ? 3 : 0,
    isConnected: relay.status === "ready",
    retry: async () => {},
    retrying: false,
  }),
}));

const airline = {
  name: "Test Air",
  corporateBalance: fp(5_000_000),
  hubs: ["MAD"],
  status: "private",
};

const network = vi.hoisted(() => ({
  fleet: [] as Array<{
    id: string;
    modelId: string;
    assignedRouteId: string | null;
    status: string;
  }>,
  routes: [] as Array<Record<string, unknown>>,
  applySuggestedFrequency: vi.fn(async () => null),
}));

vi.mock("@acars/store", async (importOriginal) => {
  const state = {
    identityStatus: "ready",
    competitors: new Map(),
    viewAs: () => {},
    applySuggestedFrequency: network.applySuggestedFrequency,
  };
  return {
    ...(await importOriginal<typeof import("@acars/store")>()),
    useActiveAirline: () => ({
      airline,
      fleet: network.fleet,
      routes: network.routes,
      timeline: [],
      isViewingOther: false,
    }),
    useAirlineStore: (selector: (s: typeof state) => unknown) => selector(state),
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => () => {},
}));

vi.mock("@/features/corporate/hooks/useFinancialPulse", () => ({
  useFinancialPulse: () => ({ avgLoadFactor: 0, flightCount: 0 }),
}));
vi.mock("@/features/corporate/hooks/useRoutePerformance", () => ({
  useRoutePerformance: () => [],
}));
// Covered by its own tests (DailyObjectivesCard.test.tsx).
vi.mock("@/features/fleet/components/AcarsFeed", () => ({ AirlineAcars: () => null }));
vi.mock("./DailyObjectivesCard", () => ({ DailyObjectivesCard: () => null }));
vi.mock("@/features/events/WorldEventsCard", () => ({ WorldEventsCard: () => null }));
vi.mock("@/shared/components/layout/PanelLayout", () => ({
  PanelLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

afterEach(() => {
  relay.status = "ready";
  network.fleet = [];
  network.routes = [];
  network.applySuggestedFrequency.mockClear();
  cleanup();
});

describe("OperationsCockpit relay card", () => {
  it("shows no status cards on the player's own cockpit while relays are healthy", () => {
    render(<OperationsCockpit />);
    // Cash, routes and load factor live in the top bar and the instruments (S78).
    expect(screen.queryByTestId("cockpit-status-cards")).not.toBeInTheDocument();
    expect(screen.queryByText("Connection")).not.toBeInTheDocument();
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
  });

  it("does not flag the first seconds of connecting as an outage", () => {
    relay.status = "connecting";
    render(<OperationsCockpit />);
    expect(screen.queryByText("Connection")).not.toBeInTheDocument();
  });

  it("shows the connection card and a warning when relays are down", () => {
    relay.status = "offline";
    render(<OperationsCockpit />);
    const cards = screen.getByTestId("cockpit-status-cards");
    expect(within(cards).getByText("Connection")).toBeInTheDocument();
    expect(within(cards).getByText("Offline")).toBeInTheDocument();
    expect(within(cards).queryByText("Cash")).not.toBeInTheDocument();
    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });
});

describe("cockpit copy", () => {
  // Player language only: no protocol or trading-floor jargon (overhaul S22.3).
  const JARGON =
    /signed action|world tape|on the tape|fuel tape|\btape\b|relay|ledger|flywheel|gauge|yield|treasury|cinta|firmad|libro operativo|volante|tesorer/i;

  const strings = (value: unknown): string[] =>
    typeof value === "string"
      ? [value]
      : Object.values(value as Record<string, unknown>).flatMap(strings);

  it.each([
    ["en", enGame.cockpit],
    ["es", esGame.cockpit],
  ])("%s cockpit strings avoid jargon", (_lang, cockpit) => {
    expect(strings(cockpit).filter((text) => JARGON.test(text))).toEqual([]);
  });
});

describe("cockpit idle planes (S58)", () => {
  const route = (id: string, frequencyPerWeek: number) => ({
    id,
    originIata: "MAD",
    destinationIata: "BCN",
    distanceKm: 483,
    frequencyPerWeek,
    status: "active",
    assignedAircraftIds: [`ac-${id}`],
  });
  const atr = (routeId: string) => ({
    id: `ac-${routeId}`,
    modelId: "atr72-600",
    assignedRouteId: routeId,
    status: "idle",
  });

  it("offers to fly more on routes whose planes sit idle", async () => {
    network.routes = [route("r1", 7), route("r2", 46)];
    network.fleet = [atr("r1"), atr("r2")];
    render(<OperationsCockpit />);
    expect(screen.getByText(/Planes on 1 route fly under 6 hours a day/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Put idle planes to work"));
    await vi.waitFor(() => expect(network.applySuggestedFrequency).toHaveBeenCalledWith("r1"));
    expect(network.applySuggestedFrequency).not.toHaveBeenCalledWith("r2");
  });

  it("stays quiet when every plane flies a full day", () => {
    network.routes = [route("r2", 46)];
    network.fleet = [atr("r2")];
    render(<OperationsCockpit />);
    expect(screen.queryByText("Put idle planes to work")).not.toBeInTheDocument();
  });
});

describe("cockpit for a new airline (S78)", () => {
  it("opens on the first-hour checklist, without empty instruments or filler", () => {
    render(<OperationsCockpit />);
    expect(screen.getByRole("heading", { level: 1, name: "Cockpit" })).toBeInTheDocument();
    expect(screen.getByTestId("first-hour-checklist")).toBeInTheDocument();
    // Nothing has flown: no instruments yet.
    expect(screen.queryByText("Utilization")).not.toBeInTheDocument();
    // No links that only repeat the sidebar.
    expect(
      screen.queryByText(/Check your finances|Check your rivals|Fine-tune your routes/),
    ).not.toBeInTheDocument();
  });
});
