import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/shared/components/layout/PanelLayout", () => {
  return {
    PanelLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock("@/features/airline/components/Timeline", () => {
  return {
    AirlineTimeline: () => <div>Timeline</div>,
  };
});

vi.mock("@airtr/store", () => {
  return {
    useAirlineStore: () => ({
      airline: {
        hubs: ["JFK"],
        corporateBalance: 0,
        name: "Test Air",
        icaoCode: "TST",
        callsign: "TEST",
        livery: { primary: "#111111", secondary: "#222222", accent: "#333333" },
        status: "private",
      },
      modifyHubs: vi.fn(),
    }),
    useEngineStore: () => ({ homeAirport: { iata: "JFK" } }),
  };
});

import CorporateRoute from "./-corporate.lazy";

describe("Corporate route", () => {
  it("renders timeline panel", () => {
    render(<CorporateRoute />);
    expect(screen.getByText("Timeline")).toBeInTheDocument();
  });
});
