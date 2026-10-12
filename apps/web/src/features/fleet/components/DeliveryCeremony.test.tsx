import { useAirlineStore } from "@acars/store";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { DeliveryCeremony } from "./DeliveryCeremony";

vi.mock("./AircraftLiveryImage", () => ({
  AircraftLiveryImage: () => <div data-testid="painting" />,
}));
const navigateToAircraft = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/permalinkNavigation", () => ({ navigateToAircraft }));

const airline = { id: "air-1", name: "Pixel", lastTick: 100, livery: { primary: "#C061CB" } };
const plane = (status: string, extra: Record<string, unknown> = {}) => ({
  id: "ac-1",
  name: "Quetzal",
  modelId: "atr72-600",
  status,
  baseAirportIata: "PTY",
  assignedRouteId: "r1",
  ...extra,
});
const route = { id: "r1", originIata: "PTY", destinationIata: "SJO" };

function deliver(extraFleet: unknown[] = []) {
  act(() => {
    useAirlineStore.setState({
      airline: airline as never,
      routes: [route] as never,
      fleet: [plane("delivery"), ...extraFleet] as never,
    });
  });
  render(<DeliveryCeremony />);
  act(() => {
    useAirlineStore.setState({
      airline: { ...airline, lastTick: 101 } as never,
      fleet: [plane("idle"), ...extraFleet] as never,
    });
  });
}

afterEach(() => {
  cleanup();
  navigateToAircraft.mockClear();
  act(() => useAirlineStore.setState({ airline: null, fleet: [], routes: [] }));
});

describe("DeliveryCeremony (S61)", () => {
  it("welcomes a plane that arrives live, with its name, salute and first flight", () => {
    deliver();
    const dialog = screen.getByTestId("delivery-ceremony");
    expect(dialog).toHaveAttribute("data-first-of-type", "true");
    expect(screen.getByRole("heading", { name: "Quetzal" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Your first ATR 72-600");
    expect(dialog).toHaveTextContent("First flight PTY → SJO");
    expect(screen.getByTestId("water-salute")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /meet quetzal/i }));
    expect(navigateToAircraft).toHaveBeenCalledWith("ac-1");
    expect(screen.queryByTestId("delivery-ceremony")).toBeNull();
  });

  it("is a plain welcome when the type is already in the fleet, and closes with Escape", () => {
    deliver([{ ...plane("idle"), id: "ac-0", name: "Dorado" }]);
    const dialog = screen.getByTestId("delivery-ceremony");
    expect(dialog).toHaveAttribute("data-first-of-type", "false");
    expect(dialog).toHaveTextContent("Delivered at PTY");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("delivery-ceremony")).toBeNull();
  });

  it("stays quiet when nothing was delivered", () => {
    render(<DeliveryCeremony />);
    act(() => useAirlineStore.setState({ fleet: [plane("idle")] as never }));
    expect(screen.queryByTestId("delivery-ceremony")).toBeNull();
  });
});
