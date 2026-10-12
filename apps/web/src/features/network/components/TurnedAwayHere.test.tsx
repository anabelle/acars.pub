import type { TimelineEvent } from "@acars/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { TurnedAwayHere } from "./TurnedAwayHere";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

afterEach(cleanup);

const landing = (to: string, pax: number, spilled: number) =>
  ({
    id: `MAD-${to}-${spilled}`,
    tick: 990,
    timestamp: 0,
    type: "landing",
    description: "",
    originIata: "MAD",
    destinationIata: to,
    details: {
      passengers: { economy: pax, business: 0, first: 0, total: pax },
      spilledPassengers: spilled,
    },
  }) as TimelineEvent;

describe("TurnedAwayHere (S63)", () => {
  it("shows who could not get a seat, by destination, with the way to add seats", () => {
    render(
      <TurnedAwayHere
        iata="MAD"
        tick={1_000}
        timeline={[landing("BCN", 70, 20), landing("LIS", 60, 8)]}
      />,
    );
    const card = screen.getByTestId("turned-away-here");
    expect(card).toHaveTextContent(
      "28 people couldn't get a seat on your flights from MAD in the last 24 h.",
    );
    expect(card).toHaveTextContent("→ BCN 20 · → LIS 8");
    expect(screen.getByRole("img", { name: "130 boarded, 28 stayed behind" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add seats/i }));
    expect(navigate).toHaveBeenCalled();
  });

  it("stays out of the way when nobody was turned away", () => {
    const { container } = render(
      <TurnedAwayHere iata="MAD" tick={1_000} timeline={[landing("BCN", 70, 0)]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
