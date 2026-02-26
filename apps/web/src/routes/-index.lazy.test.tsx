import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import OverviewDashboard from "./-index.lazy";

type Selector<T> = (state: T) => unknown;
type EngineStoreState = { routes: unknown[]; homeAirport: { iata: string } | null };
type AirlineStoreState = { routes: unknown[] };

const mockUseEngineStore = vi.fn();
const mockUseAirlineStore = vi.fn();

vi.mock("@airtr/store", () => {
  return {
    useEngineStore: (selector: Selector<EngineStoreState>) =>
      selector(mockUseEngineStore() as EngineStoreState),
    useAirlineStore: (selector: Selector<AirlineStoreState>) =>
      selector(mockUseAirlineStore() as AirlineStoreState),
  };
});

vi.mock("@/shared/components/layout/PanelLayout", () => {
  return {
    PanelLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

describe("OverviewDashboard", () => {
  it("renders nothing when no home airport", () => {
    mockUseEngineStore.mockReturnValue({ routes: [], homeAirport: null });
    mockUseAirlineStore.mockReturnValue({ routes: [] });
    const { container } = render(<OverviewDashboard />);
    expect(container.firstChild).toBeNull();
  });

  it("renders opportunities list when home airport exists", () => {
    mockUseEngineStore.mockReturnValue({
      routes: [
        {
          destination: { iata: "LAX", city: "Los Angeles" },
          demand: { economy: 10, business: 5, first: 0 },
          estimatedDailyRevenue: 0,
        },
      ],
      homeAirport: { iata: "JFK" },
    });
    mockUseAirlineStore.mockReturnValue({ routes: [] });

    render(<OverviewDashboard />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("LAX")).toBeInTheDocument();
  });
});
