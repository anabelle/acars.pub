import { fp } from "@acars/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { TodayStory } from "./TodayStory";

const navigate = vi.hoisted(() => vi.fn());
const navigateToAircraft = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/shared/lib/permalinkNavigation", () => ({ navigateToAircraft }));
vi.mock("@/features/fleet/components/AircraftLiveryImage", () => ({
  AircraftLiveryImage: () => <div data-testid="painting" />,
}));
vi.mock("@acars/store", () => {
  const state = {
    airline: { livery: { primary: "#C061CB" } },
    fleet: [{ id: "q", name: "Quetzal", modelId: "atr72-600" }],
  };
  return { useAirlineStore: (selector: (s: typeof state) => unknown) => selector(state) };
});

afterEach(() => {
  cleanup();
  navigate.mockClear();
  navigateToAircraft.mockClear();
});

const tick = 1_000_000;

describe("TodayStory (S62)", () => {
  it("tells the day: summary, chapters in order, and one tap for what needs the player", () => {
    render(
      <TodayStory
        tick={tick}
        story={{
          earned: fp(2_000),
          passengers: 134,
          landings: 2,
          onTime: { flights: 4, onTime: 3, rate: 0.75, averageDelayTicks: 200 },
          chapters: [
            {
              kind: "delivery",
              tick: tick - 9_000,
              aircraftId: "q",
              name: "Quetzal",
              airport: "PTY",
            },
            {
              kind: "bestFlight",
              tick: tick - 6_000,
              aircraftId: "q",
              name: "Quetzal",
              origin: "PTY",
              destination: "SJO",
              passengers: 64,
              profit: fp(1_200),
            },
            {
              kind: "turnedAway",
              tick: tick - 3_000,
              routeId: "r1",
              origin: "PTY",
              destination: "SJO",
              boarded: 134,
              turnedAway: 28,
            },
            { kind: "parked", tick, aircraftId: "m", name: "Mariposa", airport: "PTY", others: 2 },
          ],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: /^Today · / })).toBeInTheDocument();
    expect(screen.getByTestId("today-summary")).toHaveTextContent(
      "+$2,000 earned134 people flown2 landings",
    );
    expect(screen.getByTestId("today-on-time")).toHaveTextContent("on time 75%");
    expect(screen.getByTestId("chapter-delivery")).toHaveTextContent("Joined the fleet at PTY.");
    expect(screen.getByTestId("chapter-bestFlight")).toHaveTextContent(
      "Quetzal flew 64 people PTY → SJO and earned $1,200.",
    );
    expect(screen.getByRole("img", { name: "134 boarded, 28 stayed behind" })).toBeInTheDocument();
    expect(screen.getByTestId("chapter-parked")).toHaveTextContent(
      "Mariposa is parked at PTY with no route. 2 more planes wait too.",
    );
    fireEvent.click(screen.getByRole("button", { name: /put mariposa to work/i }));
    expect(navigateToAircraft).toHaveBeenCalledWith("m");
    fireEvent.click(screen.getByRole("button", { name: /add seats on this route/i }));
    expect(navigate).toHaveBeenCalled();
  });

  it("says when the day has been quiet", () => {
    render(
      <TodayStory
        tick={tick}
        story={{ earned: fp(0), passengers: 0, landings: 0, onTime: null, chapters: [] }}
      />,
    );
    expect(screen.getByTestId("today-story")).toHaveTextContent("A quiet day so far.");
  });
});
