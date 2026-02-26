import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FleetManager } from "./FleetManager";

type Selector<T> = (state: T) => unknown;
type AirlineStoreState = {
  airline: { hubs: string[] } | null;
  fleet: unknown[];
  routes: unknown[];
  timeline: unknown[];
  sellAircraft: () => void;
  buyoutAircraft: () => void;
  assignAircraftToRoute: () => void;
  listAircraft: () => void;
  cancelListing: () => void;
  ferryAircraft: () => void;
};
type EngineStoreState = { tick: number; tickProgress: number };

const mockUseAirlineStore = vi.fn();
const mockUseEngineStore = vi.fn();

vi.mock("@airtr/store", () => {
  return {
    useAirlineStore: (selector: Selector<AirlineStoreState>) =>
      selector(mockUseAirlineStore() as AirlineStoreState),
    useEngineStore: (selector: Selector<EngineStoreState>) =>
      selector(mockUseEngineStore() as EngineStoreState),
  };
});

vi.mock("@airtr/map", () => {
  return {
    NARROWBODY_BODY_SVG: "<svg></svg>",
    TURBOPROP_BODY_SVG: "<svg></svg>",
    WIDEBODY_BODY_SVG: "<svg></svg>",
    REGIONAL_BODY_SVG: "<svg></svg>",
  };
});

vi.mock("sonner", () => {
  return {
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock("@/shared/lib/useConfirm", () => {
  return {
    useConfirm: () => vi.fn(async () => true),
  };
});

describe("FleetManager", () => {
  it("renders empty state when fleet is empty", () => {
    mockUseAirlineStore.mockReturnValue({
      airline: { hubs: ["JFK"] },
      fleet: [],
      routes: [],
      timeline: [],
      sellAircraft: vi.fn(),
      buyoutAircraft: vi.fn(),
      assignAircraftToRoute: vi.fn(),
      listAircraft: vi.fn(),
      cancelListing: vi.fn(),
      ferryAircraft: vi.fn(),
    });
    mockUseEngineStore.mockReturnValue({ tick: 0, tickProgress: 0 });

    render(<FleetManager />);
    expect(screen.getByText("Your hangar is empty")).toBeInTheDocument();
    expect(screen.getByText("Purchase Aircraft")).toBeInTheDocument();
  });
});
