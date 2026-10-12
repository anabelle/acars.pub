import type { AircraftInstance } from "@acars/core";
import { TICKS_PER_HOUR } from "@acars/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@acars/store", () => ({
  useEngineStore: (selector: (s: { tick: number }) => unknown) => selector({ tick: 1000 }),
}));

import { BookingBar } from "@/features/network/components/BookingBar";
import { NextDepartureBookingsCard } from "./NextDepartureBookings";

afterEach(cleanup);

const plane = {
  id: "a1",
  status: "turnaround",
  turnaroundEndTick: 1000 + 2 * TICKS_PER_HOUR,
  lastKnownLoadFactor: 0.8,
  configuration: { economy: 150, business: 20, first: 0, cargoKg: 0 },
} as AircraftInstance;

describe("NextDepartureBookingsCard (S70)", () => {
  it("shows seats sold, the filling bar, and the late premium bookers", () => {
    render(<NextDepartureBookingsCard aircraft={plane} />);
    const card = screen.getByTestId("next-departure-bookings");
    expect(card).toHaveTextContent(/Next departure \d\d:\d\d · bookings/);
    expect(card).toHaveTextContent(/\d+ of 170 seats sold/);
    expect(card).toHaveTextContent(/of them business or first: they book late/);
    expect(screen.getByTestId("booking-bar")).toHaveAttribute("data-filling", "true");
  });

  it("says only how many more when no premium seats are left to sell", () => {
    render(
      <NextDepartureBookingsCard
        aircraft={{ ...plane, configuration: { economy: 170, business: 0, first: 0, cargoKg: 0 } }}
      />,
    );
    expect(screen.getByTestId("next-departure-bookings")).toHaveTextContent(
      /more expected before departure\.$/,
    );
  });

  it("stays out of the way when there is nothing to show", () => {
    render(<NextDepartureBookingsCard aircraft={{ ...plane, status: "enroute" }} />);
    expect(screen.queryByTestId("next-departure-bookings")).toBeNull();
    render(
      <NextDepartureBookingsCard
        aircraft={{ ...plane, configuration: { economy: 0, business: 0, first: 0, cargoKg: 0 } }}
      />,
    );
    expect(screen.queryByTestId("next-departure-bookings")).toBeNull();
  });
});

describe("BookingBar filling (S70)", () => {
  it("marks a flight that still sells seats", () => {
    render(<BookingBar percent={62} filling />);
    expect(screen.getByRole("img", { name: "62% ↑" })).toHaveAttribute("data-filling", "true");
    cleanup();
    render(<BookingBar percent={62} />);
    expect(screen.getByRole("img", { name: "62%" })).not.toHaveAttribute("data-filling");
  });
});
