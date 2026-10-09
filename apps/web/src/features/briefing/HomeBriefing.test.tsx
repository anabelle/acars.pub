import { fp, TICKS_PER_HOUR } from "@acars/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";

const store = vi.hoisted(() => ({
  tick: 1_000,
  active: null as unknown,
}));

vi.mock("@acars/store", () => ({
  useActiveAirline: () => store.active,
  useEngineStore: (selector: (s: { tick: number }) => unknown) => selector({ tick: store.tick }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
  }) => (
    <a href={search ? `${to}?${new URLSearchParams(search)}` : to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/features/cockpit/components/FirstHourChecklist", () => ({
  FirstHourChecklist: () => <div data-testid="first-hour-checklist" />,
}));
vi.mock("@/features/cockpit/components/DailyObjectivesCard", () => ({
  DailyObjectivesCard: () => <div data-testid="daily-objectives" />,
}));
vi.mock("@/features/events/WorldEventsCard", () => ({
  WorldEventsCard: () => <div data-testid="world-events" />,
}));

import { HomeBriefing } from "./HomeBriefing";

const airline = {
  name: "Iberia Express",
  corporateBalance: fp(1_234_567),
  cumulativeRevenue: fp(0),
  objectives: { activity: [], claimed: [] },
};
const fleet = [
  {
    id: "a1",
    name: "EC-AAA",
    status: "enroute",
    flight: { destinationIata: "BCN", arrivalTick: 1_000 + TICKS_PER_HOUR / 4 },
  },
  { id: "a2", name: "EC-BBB", status: "idle", flight: null },
];
const routes = [{ status: "active" }, { status: "active" }, { status: "suspended" }];

beforeEach(() => {
  localStorage.clear();
  store.active = { airline, fleet, routes, timeline: [], isViewingOther: false };
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

describe("HomeBriefing", () => {
  it("sums up the airline and carries the day's cards", () => {
    render(<HomeBriefing />);
    const briefing = screen.getByTestId("home-briefing");
    expect(briefing).toHaveAttribute("data-open", "true");
    expect(within(briefing).getByText("Iberia Express")).toBeInTheDocument();
    const stats = screen.getByTestId("briefing-stats");
    expect(stats).toHaveTextContent("$1,234,567");
    expect(stats).toHaveTextContent("Routes2");
    expect(stats).toHaveTextContent("In the air1");
    expect(screen.getByTestId("briefing-next-landing")).toHaveTextContent("BCN in 15m");
    for (const id of ["first-hour-checklist", "daily-objectives", "world-events"]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /open operator cockpit/i })).toHaveAttribute(
      "href",
      "/?panel=cockpit",
    );
  });

  it("folds to the summary and remembers it on this device", () => {
    const { unmount } = render(<HomeBriefing />);
    fireEvent.click(screen.getByRole("button", { name: "Hide the briefing" }));
    expect(screen.getByTestId("home-briefing")).toHaveAttribute("data-open", "false");
    expect(screen.queryByTestId("daily-objectives")).not.toBeInTheDocument();
    // The summary stays.
    expect(screen.getByTestId("briefing-stats")).toBeInTheDocument();
    unmount();

    render(<HomeBriefing />);
    expect(screen.getByTestId("home-briefing")).toHaveAttribute("data-open", "false");
    fireEvent.click(screen.getByRole("button", { name: "Show the briefing" }));
    expect(screen.getByTestId("daily-objectives")).toBeInTheDocument();
  });

  it("starts folded on the map-only view, and folds when switched to it", () => {
    const { unmount } = render(<HomeBriefing startCollapsed />);
    expect(screen.getByTestId("home-briefing")).toHaveAttribute("data-open", "false");
    unmount();

    const { rerender } = render(<HomeBriefing />);
    expect(screen.getByTestId("home-briefing")).toHaveAttribute("data-open", "true");
    rerender(<HomeBriefing startCollapsed />);
    expect(screen.getByTestId("home-briefing")).toHaveAttribute("data-open", "false");
  });

  it("keeps another airline's cards private and has nothing without an airline", () => {
    store.active = { airline, fleet: [], routes, timeline: [], isViewingOther: true };
    const { unmount } = render(<HomeBriefing />);
    expect(screen.queryByTestId("daily-objectives")).not.toBeInTheDocument();
    expect(screen.getByTestId("briefing-next-landing")).toHaveTextContent("None in the air");
    unmount();

    store.active = { airline: null, fleet: [], routes: [], timeline: [], isViewingOther: false };
    render(<HomeBriefing />);
    expect(screen.queryByTestId("home-briefing")).not.toBeInTheDocument();
  });

  it("renders in Spanish", async () => {
    await i18n.changeLanguage("es");
    render(<HomeBriefing />);
    expect(screen.getByText("Resumen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocultar el resumen" })).toBeInTheDocument();
    expect(screen.getByTestId("briefing-stats")).toHaveTextContent("En el aire");
  });
});
