import type { FlightOffer, Route } from "@acars/core";
import { fp } from "@acars/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RivalAnnounced, TimetableAnnounced } from "./TimetableNote";

afterEach(cleanup);

const route = {
  id: "r1",
  fareEconomy: fp(100),
  fareBusiness: fp(300),
  fareFirst: fp(600),
} as Route;

const offer = { airlinePubkey: "rival", fareEconomy: fp(90) } as FlightOffer;

describe("TimetableAnnounced (S69)", () => {
  it("lists every announced change", () => {
    render(
      <TimetableAnnounced
        route={{
          ...route,
          pending: {
            effectiveTick: 10,
            fareEconomy: fp(80),
            fareBusiness: fp(250),
            fareFirst: fp(500),
            frequencyPerWeek: 3,
          },
        }}
      />,
    );
    expect(screen.getByTestId("timetable-announced")).toHaveTextContent(
      "From 00:00 UTC: E $80 · B $250 · F $500 · 3/wk",
    );
  });

  it("shows nothing without an announcement", () => {
    render(<TimetableAnnounced route={route} />);
    expect(screen.queryByTestId("timetable-announced")).toBeNull();
  });
});

describe("RivalAnnounced (S69)", () => {
  it("shows a rival's coming economy fare until it is in force", () => {
    const next = { ...offer, next: { effectiveTick: 10, fareEconomy: fp(70) } };
    const { rerender } = render(<RivalAnnounced offer={next} tick={9} />);
    expect(screen.getByTestId("rival-announced")).toHaveTextContent("From 00:00 UTC: E $70");
    rerender(<RivalAnnounced offer={next} tick={10} />);
    expect(screen.queryByTestId("rival-announced")).toBeNull();
    rerender(<RivalAnnounced offer={offer} tick={9} />);
    expect(screen.queryByTestId("rival-announced")).toBeNull();
    rerender(<RivalAnnounced offer={{ ...offer, next: { effectiveTick: 10 } }} tick={9} />);
    expect(screen.queryByTestId("rival-announced")).toBeNull();
  });
});
