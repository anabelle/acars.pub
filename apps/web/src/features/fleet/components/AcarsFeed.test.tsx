import { TICKS_PER_HOUR } from "@acars/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigateToAircraft = vi.fn();
vi.mock("@/shared/lib/permalinkNavigation", () => ({
  navigateToAircraft: (id: string) => navigateToAircraft(id),
}));

import type { AcarsMessage } from "../utils/acars";
import { AcarsFeed } from "./AcarsFeed";

const msg = (kind: AcarsMessage["kind"], tick: number, body: string): AcarsMessage => ({
  id: `${kind}-${tick}`,
  tick,
  kind,
  aircraftId: "a1",
  aircraftName: "Quetzal",
  flight: "EEA 2134",
  origin: "MAD",
  destination: "BCN",
  body,
});

afterEach(() => {
  cleanup();
  navigateToAircraft.mockClear();
});

describe("AcarsFeed", () => {
  it("prints each message with its UTC time, code and body", () => {
    render(
      <AcarsFeed
        messages={[
          msg("IN", 10 * TICKS_PER_HOUR, "BCN PAX 140 LF 88%"),
          msg("OUT", 9 * TICKS_PER_HOUR, "MAD-BCN"),
        ]}
      />,
    );
    const rows = screen.getAllByTestId("acars-message");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-kind", "IN");
    expect(rows[0]).toHaveTextContent(/\d\d:\d\dZ\s*IN\s*BCN PAX 140 LF 88%/);
    expect(screen.queryByRole("button", { name: "EEA 2134" })).toBeNull();
  });

  it("names the flight in the airline feed and opens the plane", () => {
    render(<AcarsFeed showPlane messages={[msg("OFF", 5, "MAD FL340")]} />);
    fireEvent.click(screen.getByRole("button", { name: "EEA 2134" }));
    expect(navigateToAircraft).toHaveBeenCalledWith("a1");
  });

  it("says when there is nothing yet", () => {
    render(<AcarsFeed messages={[]} />);
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
  });
});
