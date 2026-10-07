import { setActiveEventsOverride, type WorldEvent } from "@acars/core";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { WorldEventsCard } from "./WorldEventsCard";

vi.mock("@acars/store", () => ({
  useEngineStore: (selector: (s: { tick: number }) => unknown) => selector({ tick: 1000 }),
}));

const event = (overrides: Partial<WorldEvent>): WorldEvent => ({
  id: "e",
  kind: "festival",
  airportIata: "BCN",
  startTick: 0,
  endTick: 1000 + 18 * 1200,
  demandMultiplier: 1.3,
  feesMultiplier: 1,
  fuelMultiplier: 1,
  ...overrides,
});

const routes = [{ id: "r1", originIata: "MAD", destinationIata: "BCN" }] as unknown as Parameters<
  typeof WorldEventsCard
>[0]["routes"];

afterEach(async () => {
  cleanup();
  setActiveEventsOverride(null);
  await i18n.changeLanguage("en");
});

describe("WorldEventsCard", () => {
  it("shows active events, their effects and the player's routes they touch", () => {
    setActiveEventsOverride([
      event({ id: "a" }),
      event({
        id: "b",
        kind: "hubCongestion",
        airportIata: "SYD",
        demandMultiplier: 1,
        feesMultiplier: 1.2,
      }),
    ]);
    render(<WorldEventsCard routes={routes} />);
    const festival = screen.getByTestId("world-event-festival");
    expect(festival).toHaveAttribute("data-affects-you", "true");
    expect(festival).toHaveTextContent("Festival");
    expect(festival).toHaveTextContent("Demand +30%");
    expect(festival).toHaveTextContent("Your routes: MAD–BCN");
    expect(festival).toHaveTextContent("18h left");
    const jam = screen.getByTestId("world-event-hubCongestion");
    expect(jam).toHaveAttribute("data-affects-you", "false");
    expect(jam).toHaveTextContent("Airport fees +20%");
    expect(jam).toHaveTextContent("None of your routes");
  });

  it("says when the world is quiet", () => {
    setActiveEventsOverride([]);
    render(<WorldEventsCard routes={routes} />);
    const card = screen.getByTestId("world-events");
    // The real schedule may still list upcoming events; no active ones are shown.
    expect(within(card).queryByText("Now")).not.toBeInTheDocument();
  });

  it("renders in Spanish", async () => {
    await i18n.changeLanguage("es");
    setActiveEventsOverride([
      event({ kind: "fuelSpike", airportIata: null, demandMultiplier: 1, fuelMultiplier: 1.15 }),
    ]);
    render(<WorldEventsCard routes={routes} />);
    expect(screen.getByText("Qué está pasando")).toBeInTheDocument();
    const spike = screen.getByTestId("world-event-fuelSpike");
    expect(spike).toHaveTextContent("Subida del combustible · Mundial");
    expect(spike).toHaveTextContent("Combustible +15%");
    expect(spike).toHaveTextContent("Tus rutas: MAD–BCN");
  });
});
