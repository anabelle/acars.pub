import { fp } from "@acars/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    onClick?: () => void;
    className?: string;
  }) => {
    let href = to;
    for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
    if (search) href += `?${new URLSearchParams(search)}`;
    return (
      <a
        href={href}
        className={className}
        onClick={(event) => {
          event.preventDefault();
          onClick?.();
        }}
      >
        {children}
      </a>
    );
  },
}));

const timeLapse = vi.hoisted(() => ({ playTimeLapse: vi.fn() }));
vi.mock("@/features/airline/lib/timeLapseState", () => timeLapse);

import type { TimelineEvent } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import type { TimelineSummary } from "@/features/airline/utils/summarizeTimeline";
import { AwayReportDialog } from "./AwayReport";

afterEach(() => {
  cleanup();
  timeLapse.playTimeLapse.mockClear();
  useAirlineStore.setState({ timeline: [] });
});

const base: TimelineSummary = {
  fromTick: 0,
  toTick: 12 * 1200,
  flights: 24,
  passengers: 1630,
  revenue: fp(310_000),
  costs: fp(240_000),
  profit: fp(70_000),
  leasePayments: fp(0),
  bestRoute: {
    routeId: "r1",
    originIata: "MAD",
    destinationIata: "BCN",
    flights: 14,
    passengers: 1000,
    profit: fp(60_000),
  },
  worstRoute: {
    routeId: "r2",
    originIata: "MAD",
    destinationIata: "LIS",
    flights: 10,
    passengers: 630,
    profit: fp(-4_000),
  },
  groundedAircraft: [{ id: "a1", name: "EC-AAA" }],
  deliveries: 1,
  newTier: 2,
  priceWarRoutes: ["MAD-LIS"],
  bankrupt: false,
  complete: true,
  coveredFromTick: 0,
};

describe("AwayReportDialog", () => {
  it("tells the story of the absence", () => {
    render(<AwayReportDialog summary={base} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: /how your airline did/i })).toBeInTheDocument();
    expect(screen.getByText(/While you were away · 12 hours/)).toBeInTheDocument();
    expect(screen.getByTestId("away-report-profit").textContent).toContain("+$70,000");
    expect(screen.getByText("MAD ⇄ BCN")).toBeInTheDocument();
    expect(screen.getByText("-$4,000")).toBeInTheDocument();
    expect(screen.getByText(/Promoted to Tier 2/)).toBeInTheDocument();
    expect(screen.getByText(/Grounded for maintenance:/)).toBeInTheDocument();
    expect(screen.getByText(/price war/)).toBeInTheDocument();
    expect(screen.queryByText(/Only the most recent events/)).toBeNull();
  });

  it("handles a quiet absence and a partial window", () => {
    render(
      <AwayReportDialog
        summary={{
          ...base,
          flights: 0,
          bestRoute: null,
          worstRoute: null,
          groundedAircraft: [],
          newTier: null,
          deliveries: 0,
          complete: false,
          coveredFromTick: 6 * 1200,
          toTick: 3 * 24 * 1200,
        }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Your airline was quiet/)).toBeInTheDocument();
    expect(screen.getByText(/2 days/)).toBeInTheDocument();
    expect(screen.getByText(/Only the most recent events/)).toBeInTheDocument();
  });

  it("closes from the button and with Escape", () => {
    const onClose = vi.fn();
    render(<AwayReportDialog summary={base} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /back to my airline/i }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("deep-links routes, grounded aircraft, price wars and the activity log, closing on navigation", () => {
    const onClose = vi.fn();
    render(<AwayReportDialog summary={base} onClose={onClose} />);

    const hrefOf = (name: RegExp | string) =>
      screen.getByRole("link", { name }).getAttribute("href");
    expect(hrefOf(/Best route/)).toBe("/airport/BCN");
    expect(hrefOf(/Weakest route/)).toBe("/airport/LIS");
    expect(hrefOf("EC-AAA")).toBe("/aircraft/a1");
    expect(hrefOf("MAD-LIS")).toBe("/airport/LIS");
    expect(hrefOf(/Full activity log/)).toBe("/corporate?section=activity");

    fireEvent.click(screen.getByRole("link", { name: "EC-AAA" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("offers the time-lapse of the flights that landed, and starts it", () => {
    const landing = (id: string, tick: number) =>
      ({
        id,
        tick,
        timestamp: 0,
        type: "landing",
        description: "",
        aircraftId: "ac1",
        originIata: "MAD",
        destinationIata: "BCN",
        details: { flightDurationTicks: 1_500 },
      }) as TimelineEvent;
    useAirlineStore.setState({ timeline: [landing("l1", 3_000), landing("l2", 6_000)] });
    const onClose = vi.fn();
    render(<AwayReportDialog summary={base} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Watch what happened (2 flights)" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(timeLapse.playTimeLapse).toHaveBeenCalledWith(
      expect.objectContaining({ startTick: 1_500, endTick: 6_000 }),
    );
  });

  it("has no time-lapse when no landing can be replayed", () => {
    render(<AwayReportDialog summary={base} onClose={() => {}} />);
    expect(screen.queryByTestId("away-report-watch")).not.toBeInTheDocument();
  });
});
