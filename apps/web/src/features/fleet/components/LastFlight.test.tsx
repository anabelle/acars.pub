import type { TimelineEvent } from "@acars/core";
import { fp } from "@acars/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@/i18n";
import { passengerVoice } from "../utils/cabin";
import { LastFlight } from "./LastFlight";

afterEach(cleanup);

const aircraft = { configuration: { economy: 60, business: 8, first: 0, cargoKg: 0 } } as never;
const landing = (id: string) =>
  ({
    id,
    tick: 1_000,
    timestamp: 0,
    type: "landing",
    description: "",
    originIata: "PTY",
    destinationIata: "SJO",
    profit: fp(-120),
    details: {
      loadFactor: 0.88,
      passengers: { economy: 54, business: 6, first: 0, total: 60 },
      revenue: {
        tickets: fp(9_000),
        economy: fp(7_000),
        business: fp(2_000),
        first: fp(0),
        ancillary: fp(400),
      },
      costs: {
        fuel: fp(3_000),
        crew: fp(1_500),
        maintenance: fp(900),
        airport: fp(800),
        navigation: fp(500),
        leasing: fp(2_000),
        handling: fp(700),
        distribution: fp(560),
        overhead: fp(560),
      },
    },
  }) as TimelineEvent;

describe("LastFlight (S63)", () => {
  it("prints a receipt with every line and a red net when the flight lost money", () => {
    render(<LastFlight aircraft={aircraft} landing={landing("quiet")} />);
    const receipt = screen.getByTestId("landing-receipt");
    expect(receipt).toHaveTextContent("Economy$7,000");
    expect(receipt).toHaveTextContent("Bags & meals$400");
    expect(receipt).toHaveTextContent("Fuel−$3,000");
    expect(receipt).toHaveTextContent("Booking fees−$560");
    expect(receipt).toHaveTextContent("Net-$120");
    expect(screen.getByTestId("cabin-strip")).toHaveAccessibleName("60 of 68 seats taken");
  });

  it("lets a passenger speak on the flights the voice picks", () => {
    const voiced = Array.from({ length: 30 }, (_, i) => `evt-${i}`).find(
      (id) => passengerVoice(landing(id)) !== null,
    );
    expect(voiced).toBeDefined();
    render(<LastFlight aircraft={aircraft} landing={landing(voiced as string)} />);
    expect(screen.getByTestId("passenger-voice")).toHaveTextContent(/” — seat \d+[A-F]$/);
  });
});
