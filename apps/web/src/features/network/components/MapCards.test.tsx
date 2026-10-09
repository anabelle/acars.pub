import { type Airport, GENESIS_TIME, TICK_DURATION, TICKS_PER_HOUR } from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { AircraftMapCard } from "./AircraftMapCard";
import { AirportMapCard } from "./AirportMapCard";

const initialAirline = useAirlineStore.getState();
const initialEngine = useEngineStore.getState();
// The deterministic schedule runs a festival in Barcelona from 2026-10-06 09:00 UTC.
const FESTIVAL_TICK = (Date.parse("2026-10-06T12:00:00Z") - GENESIS_TIME) / TICK_DURATION;

const bcn = {
  iata: "BCN",
  name: "Barcelona International Airport",
  city: "Barcelona",
  country: "ES",
} as Airport;

beforeEach(() => {
  useEngineStore.setState({ tick: FESTIVAL_TICK } as never);
  useAirlineStore.setState({
    airline: { hubs: ["MAD"] },
    routes: [
      { id: "r1", originIata: "MAD", destinationIata: "BCN", status: "active" },
      { id: "r2", originIata: "MAD", destinationIata: "LIS", status: "active" },
      { id: "r3", originIata: "BCN", destinationIata: "ORY", status: "suspended" },
    ],
    fleet: [
      { id: "a1", status: "idle", baseAirportIata: "BCN" },
      { id: "a2", status: "enroute", baseAirportIata: "BCN" },
    ],
    competitors: new Map([
      ["r-1", { name: "Vueling Rival", hubs: ["BCN"] }],
      ["r-2", { name: "Other", hubs: ["LIS"] }],
    ]),
  } as never);
});

afterEach(async () => {
  cleanup();
  useAirlineStore.setState(initialAirline, true);
  useEngineStore.setState(initialEngine, true);
  await i18n.changeLanguage("en");
});

describe("AirportMapCard", () => {
  it("sums up the airport for you, with the event on now and a door to details", () => {
    const onOpenDetails = vi.fn();
    render(<AirportMapCard airport={bcn} onOpenDetails={onOpenDetails} onClose={() => {}} />);
    const card = screen.getByTestId("airport-card");
    expect(card).toHaveTextContent("Barcelona International Airport");
    expect(card).toHaveTextContent("BCN · Barcelona, ES");
    expect(screen.getByTestId("airport-card-routes")).toHaveTextContent("1");
    expect(card).toHaveTextContent("Your aircraft here1");
    expect(screen.getByTestId("airport-card-hub")).toHaveTextContent("A rival's hub");
    expect(screen.getByTestId("airport-card-event")).toHaveTextContent("Festival on now");
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it("says when it is your hub, or nobody's, and that nothing is on", () => {
    useEngineStore.setState({ tick: FESTIVAL_TICK - 30 * 24 * TICKS_PER_HOUR } as never);
    const mad = { ...bcn, iata: "MAD", name: "Madrid", city: "Madrid" };
    const { unmount } = render(
      <AirportMapCard airport={mad} onOpenDetails={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByTestId("airport-card-hub")).toHaveTextContent("Your hub");
    unmount();
    const opo = { ...bcn, iata: "OPO", name: "Porto", city: "Porto", country: "PT" };
    render(<AirportMapCard airport={opo} onOpenDetails={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId("airport-card-hub")).toHaveTextContent("Nobody's hub yet");
    expect(screen.getByTestId("airport-card-routes")).toHaveTextContent("0");
  });

  it("closes on X and Escape, and speaks Spanish", async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <AirportMapCard airport={bcn} onOpenDetails={() => {}} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close the airport card" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount();
    await i18n.changeLanguage("es");
    render(<AirportMapCard airport={bcn} onOpenDetails={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Ver detalles" })).toBeInTheDocument();
    expect(screen.getByText("Tus rutas aquí")).toBeInTheDocument();
  });
});

describe("AircraftMapCard", () => {
  const flying = {
    id: "a2",
    name: "EC-ABC",
    modelId: "a320neo",
    ownerPubkey: "me",
    status: "enroute",
    baseAirportIata: "MAD",
    flight: {
      originIata: "MAD",
      destinationIata: "BCN",
      departureTick: FESTIVAL_TICK - TICKS_PER_HOUR / 2,
      arrivalTick: FESTIVAL_TICK + TICKS_PER_HOUR / 2,
      direction: "outbound",
    },
  } as never;

  it("shows a flight in progress: route, how far along and when it lands", () => {
    const onOpenDetails = vi.fn();
    render(
      <AircraftMapCard
        aircraft={flying}
        isPlayer
        onOpenDetails={onOpenDetails}
        onClose={() => {}}
      />,
    );
    const card = screen.getByTestId("aircraft-card");
    expect(card).toHaveAttribute("data-owner", "player");
    expect(card).toHaveTextContent("EC-ABC");
    expect(card).toHaveTextContent("A320neo · Your aircraft");
    expect(screen.getByTestId("aircraft-card-status")).toHaveTextContent("En Route");
    expect(screen.getByTestId("aircraft-card-where")).toHaveTextContent("MAD → BCN");
    expect(screen.getByTestId("aircraft-card-progress")).toHaveTextContent("50%");
    expect(card).toHaveTextContent("Lands in30m");
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it("shows a parked rival aircraft at its base, named by its airline", () => {
    const parked = {
      ...(flying as object),
      ownerPubkey: "r-1",
      status: "idle",
      flight: null,
    } as never;
    render(
      <AircraftMapCard
        aircraft={parked}
        isPlayer={false}
        onOpenDetails={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("aircraft-card")).toHaveAttribute("data-owner", "rival");
    expect(screen.getByTestId("aircraft-card")).toHaveTextContent("A320neo · Vueling Rival");
    expect(screen.getByTestId("aircraft-card-status")).toHaveTextContent("Idle");
    expect(screen.getByTestId("aircraft-card-where")).toHaveTextContent("MAD");
    expect(screen.queryByTestId("aircraft-card-progress")).not.toBeInTheDocument();
  });
});
