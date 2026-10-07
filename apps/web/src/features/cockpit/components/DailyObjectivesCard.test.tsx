import { type Airport, objectiveDayWindow } from "@acars/core";
import { setAirportsCatalog } from "@acars/data";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { DailyObjectivesCard } from "./DailyObjectivesCard";

const DAY = objectiveDayWindow("2026-10-07");

const store = vi.hoisted(() => ({
  tick: 0,
  claimObjective: vi.fn<(objectiveId: string) => Promise<void>>(async () => {}),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@acars/store", () => ({
  useEngineStore: (selector: (s: { tick: number }) => unknown) => selector({ tick: store.tick }),
  useAirlineStore: (selector: (s: { claimObjective: typeof store.claimObjective }) => unknown) =>
    selector({ claimObjective: store.claimObjective }),
}));
vi.mock("sonner", () => ({ toast }));

beforeAll(() => {
  setAirportsCatalog([
    { iata: "MAD", latitude: 40.47, longitude: -3.56, tags: ["business"] },
    { iata: "JFK", latitude: 40.64, longitude: -73.78, tags: ["business"] },
  ] as unknown as Airport[]);
});

afterEach(async () => {
  cleanup();
  store.claimObjective.mockClear();
  toast.success.mockClear();
  toast.error.mockClear();
  await i18n.changeLanguage("en");
});

const ledger = {
  activity: [
    {
      type: "routeOpened" as const,
      tick: DAY.startTick + 10,
      routeId: "r1",
      originIata: "MAD",
      destinationIata: "JFK",
    },
  ],
  claimed: ["2026-10-07:openRouteToTag"],
};

describe("DailyObjectivesCard", () => {
  it("shows the day's objectives, progress, rewards and reset time", () => {
    store.tick = DAY.startTick + 1_200 * 2; // 02:00 UTC
    render(<DailyObjectivesCard ledger={ledger} />);
    const card = screen.getByTestId("daily-objectives");
    expect(within(card).getByText("Open a route of at least 1,000 km")).toBeInTheDocument();
    expect(within(card).getByText("Open a route to a business destination")).toBeInTheDocument();
    expect(within(card).getByText("Change a route's weekly frequency")).toBeInTheDocument();
    expect(screen.getByTestId("objectives-reset")).toHaveTextContent("Resets in 22h 0m");

    const open = screen.getByTestId("objective-openRoute");
    expect(open).toHaveAttribute("data-complete", "true");
    expect(within(open).getByRole("button", { name: "Claim" })).toBeInTheDocument();
    expect(
      within(screen.getByTestId("objective-openRouteToTag")).getByText("Claimed"),
    ).toBeInTheDocument();
    const schedule = screen.getByTestId("objective-adjustSchedule");
    expect(schedule).toHaveAttribute("data-complete", "false");
    expect(within(schedule).getByText(/0\/1/)).toBeInTheDocument();
    expect(within(schedule).queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the day's event objective, done by a route to its airport", () => {
    store.tick = DAY.startTick + 100;
    const { rerender } = render(<DailyObjectivesCard ledger={ledger} />);
    const event = screen.getByTestId("objective-routeToEvent");
    expect(within(event).getByText("Festival at BCN: open a route there")).toBeInTheDocument();
    expect(event).toHaveAttribute("data-complete", "false");
    const toBcn = {
      type: "routeOpened" as const,
      tick: DAY.startTick + 20,
      routeId: "r2",
      originIata: "MAD",
      destinationIata: "BCN",
    };
    rerender(<DailyObjectivesCard ledger={{ ...ledger, activity: [...ledger.activity, toBcn] }} />);
    expect(screen.getByTestId("objective-routeToEvent")).toHaveAttribute("data-complete", "true");
  });

  it("claims through the store and confirms", async () => {
    store.tick = DAY.startTick + 100;
    render(<DailyObjectivesCard ledger={ledger} />);
    fireEvent.click(screen.getByRole("button", { name: "Claim" }));
    expect(store.claimObjective).toHaveBeenCalledWith("2026-10-07:openRoute");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Reward claimed"));
  });

  it("reports a failed claim", async () => {
    store.tick = DAY.startTick + 100;
    store.claimObjective.mockRejectedValueOnce(new Error("relay down"));
    render(<DailyObjectivesCard ledger={ledger} />);
    fireEvent.click(screen.getByRole("button", { name: "Claim" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't claim the reward", {
        description: "relay down",
      }),
    );
  });

  it("renders in Spanish", async () => {
    store.tick = DAY.startTick + 100;
    await i18n.changeLanguage("es");
    render(<DailyObjectivesCard ledger={ledger} />);
    expect(screen.getByText("Metas de hoy")).toBeInTheDocument();
    expect(screen.getByText("Abre una ruta a un destino de negocios")).toBeInTheDocument();
    expect(screen.getByText("Festival en BCN: abre una ruta allí")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reclamar" })).toBeInTheDocument();
  });
});
