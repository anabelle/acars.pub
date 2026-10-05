import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AirlineCreator } from "./AirlineCreator";

type Selector<T> = (state: T) => unknown;
type AirlineStoreState = {
  createAirline: () => void;
  identityStatus: string;
  isLoading: boolean;
  error: unknown;
  competitors: Map<string, unknown>;
  isEphemeral?: boolean;
};
type EngineStoreState = {
  homeAirport: {
    iata: string;
    city: string;
    name: string;
    latitude: number;
    longitude: number;
    country: string;
  } | null;
  setHub: () => void;
};

const mockUseAirlineStore = vi.fn();
const mockUseEngineStore = vi.fn();

vi.mock("@acars/store", () => {
  return {
    useAirlineStore: (selector?: Selector<AirlineStoreState>) => {
      const state = mockUseAirlineStore() as AirlineStoreState;
      return selector ? selector(state) : state;
    },
    useEngineStore: (selector: Selector<EngineStoreState>) =>
      selector(mockUseEngineStore() as EngineStoreState),
  };
});

vi.mock("../../network/components/HubPicker", () => {
  return {
    HubPicker: ({ currentHub }: { currentHub: { iata: string } | null }) => (
      <div>Hub Picker {currentHub?.iata ?? "none"}</div>
    ),
  };
});

vi.mock("./EphemeralKeyBackupActions", () => {
  return {
    EphemeralKeyBackupActions: () => <div>Backup Actions</div>,
  };
});

vi.mock("../utils/airlineConflicts", () => {
  return {
    findAirlineConflicts: () => ({ nameConflict: null, icaoConflict: null }),
  };
});

describe("AirlineCreator", () => {
  it("renders hub details when home airport set", () => {
    mockUseAirlineStore.mockReturnValue({
      createAirline: vi.fn(),
      identityStatus: "ready",
      isLoading: false,
      error: null,
      competitors: new Map(),
    });

    mockUseEngineStore.mockReturnValue({
      homeAirport: {
        iata: "JFK",
        city: "New York",
        name: "John F Kennedy International",
        latitude: 0,
        longitude: 0,
        country: "US",
      },
      setHub: vi.fn(),
    });

    render(<AirlineCreator />);
    expect(screen.getByText("Launch Your Airline")).toBeInTheDocument();
    expect(screen.getAllByText("JFK").length).toBeGreaterThan(0);
    expect(screen.getByText(/John F Kennedy International/)).toBeInTheDocument();
  });

  it("disables submit without required fields", () => {
    mockUseAirlineStore.mockReturnValue({
      createAirline: vi.fn(),
      identityStatus: "ready",
      isLoading: false,
      error: null,
      competitors: new Map(),
    });

    mockUseEngineStore.mockReturnValue({
      homeAirport: {
        iata: "JFK",
        city: "New York",
        name: "John F Kennedy International",
        latitude: 0,
        longitude: 0,
        country: "US",
      },
      setHub: vi.fn(),
    });

    render(<AirlineCreator />);
    const submit = screen.getAllByRole("button", { name: /Launch Airline/i })[0];
    expect(submit).toBeDisabled();

    // S21: the name is the only field a player has to fill.
    fireEvent.change(screen.getAllByPlaceholderText("Apex Global")[0], {
      target: { value: "Apex" },
    });
    expect(submit).not.toBeDisabled();
  });

  it("submits a name and hub with a suggested code, callsign and livery (S21)", async () => {
    const createAirline = vi.fn<(params: Record<string, unknown>) => Promise<void>>(async () => {});
    mockUseAirlineStore.mockReturnValue({
      createAirline,
      identityStatus: "ready",
      isLoading: false,
      error: null,
      competitors: new Map(),
    });
    mockUseEngineStore.mockReturnValue({
      homeAirport: {
        iata: "JFK",
        city: "New York",
        name: "John F Kennedy International",
        latitude: 0,
        longitude: 0,
        country: "US",
      },
      setHub: vi.fn(),
    });

    render(<AirlineCreator />);
    fireEvent.change(screen.getAllByPlaceholderText("Apex Global")[0], {
      target: { value: "Trans Atlantic Wings" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Launch Airline/i })[0]);

    await vi.waitFor(() => expect(createAirline).toHaveBeenCalledTimes(1));
    expect(createAirline.mock.calls[0][0]).toMatchObject({
      name: "Trans Atlantic Wings",
      icaoCode: "TAW",
      callsign: "TRANS",
      hubs: ["JFK"],
      livery: { primary: expect.stringMatching(/^#[0-9a-f]{6}$/) },
    });
  });

  it("shows account key tools for ephemeral identities", () => {
    mockUseAirlineStore.mockReturnValue({
      createAirline: vi.fn(),
      identityStatus: "ready",
      isLoading: false,
      error: null,
      competitors: new Map(),
      isEphemeral: true,
    });

    mockUseEngineStore.mockReturnValue({
      homeAirport: {
        iata: "JFK",
        city: "New York",
        name: "John F Kennedy International",
        latitude: 0,
        longitude: 0,
        country: "US",
      },
      setHub: vi.fn(),
    });

    render(<AirlineCreator />);
    fireEvent.click(screen.getByRole("button", { name: /Account key/i }));

    expect(screen.getByText("Backup Actions")).toBeInTheDocument();
  });
});
