import { fp } from "@acars/core";
import { cleanup, render, screen, within } from "@testing-library/react";
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

vi.mock("@acars/store", () => {
  const state = { identityStatus: "ready", competitors: new Map(), viewAs: () => {} };
  return {
    useActiveAirline: () => ({
      airline,
      fleet: [],
      routes: [],
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
vi.mock("./DailyObjectivesCard", () => ({ DailyObjectivesCard: () => null }));
vi.mock("@/features/events/WorldEventsCard", () => ({ WorldEventsCard: () => null }));
vi.mock("@/shared/components/layout/PanelLayout", () => ({
  PanelLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

afterEach(() => {
  relay.status = "ready";
  cleanup();
});

describe("OperationsCockpit relay card", () => {
  it("hides the connection card while relays are healthy", () => {
    render(<OperationsCockpit />);
    const cards = screen.getByTestId("cockpit-status-cards");
    expect(within(cards).getByText("Cash")).toBeInTheDocument();
    expect(within(cards).queryByText("Connection")).not.toBeInTheDocument();
    expect(cards).toHaveClass("2xl:grid-cols-3");
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
    expect(cards).toHaveClass("2xl:grid-cols-4");
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
