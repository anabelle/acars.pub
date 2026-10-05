import { fp } from "@acars/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TimelineSummary } from "@/features/airline/utils/summarizeTimeline";
import { AwayReportDialog } from "./AwayReport";

afterEach(cleanup);

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
  priceWarRoutes: [],
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
    expect(screen.getByText(/Grounded for maintenance: EC-AAA/)).toBeInTheDocument();
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
});
