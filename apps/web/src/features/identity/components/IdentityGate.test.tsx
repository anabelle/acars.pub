import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IdentityGate } from "./IdentityGate";

const mockUseAirlineStore = vi.fn();

vi.mock("@airtr/store", () => {
  return {
    useAirlineStore: () => mockUseAirlineStore(),
  };
});

vi.mock("./AirlineCreator", () => {
  return {
    AirlineCreator: () => <div>Airline Creator</div>,
  };
});

describe("IdentityGate", () => {
  it("renders loading state while checking identity", () => {
    mockUseAirlineStore.mockReturnValue({
      identityStatus: "checking",
      airline: null,
      initializeIdentity: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(
      <IdentityGate>
        <div>App</div>
      </IdentityGate>,
    );

    expect(screen.getByText(/Establishing secure connection/i)).toBeInTheDocument();
  });

  it("renders extension required prompt and retry action", () => {
    const initializeIdentity = vi.fn();
    mockUseAirlineStore.mockReturnValue({
      identityStatus: "no-extension",
      airline: null,
      initializeIdentity,
      isLoading: false,
      error: null,
    });

    render(
      <IdentityGate>
        <div>App</div>
      </IdentityGate>,
    );

    const button = screen.getByRole("button", { name: /Retry Connection/i });
    fireEvent.click(button);
    expect(initializeIdentity).toHaveBeenCalled();
  });

  it("renders airline creator when identity is ready without airline", () => {
    mockUseAirlineStore.mockReturnValue({
      identityStatus: "ready",
      airline: null,
      initializeIdentity: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(
      <IdentityGate>
        <div>App</div>
      </IdentityGate>,
    );

    expect(screen.getByText("Airline Creator")).toBeInTheDocument();
  });

  it("renders children when airline is available", () => {
    mockUseAirlineStore.mockReturnValue({
      identityStatus: "ready",
      airline: { id: "airline" },
      initializeIdentity: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(
      <IdentityGate>
        <div>App</div>
      </IdentityGate>,
    );

    expect(screen.getByText("App")).toBeInTheDocument();
  });
});
