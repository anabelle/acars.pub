import type { AircraftInstance, Route } from "@acars/core";
import { fp } from "@acars/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setAircraftLine = vi.fn(async () => null);
const route = (id: string, o: string, d: string, km: number): Route =>
  ({
    id,
    originIata: o,
    destinationIata: d,
    distanceKm: km,
    airlinePubkey: "me",
    assignedAircraftIds: [],
    fareEconomy: fp(1),
    fareBusiness: fp(1),
    fareFirst: fp(1),
    status: "active",
  }) as Route;
const state = {
  routes: [route("r1", "MAD", "BCN", 483), route("r3", "MAD", "LIS", 513)],
  setAircraftLine,
};
vi.mock("@acars/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@acars/store")>()),
  useAirlineStore: (selector: (s: typeof state) => unknown) => selector(state),
  useEngineStore: (selector: (s: { tick: number }) => unknown) => selector({ tick: 1000 }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { LineSection } from "./LineSection";

const plane = {
  id: "ac-1",
  name: "Quetzal",
  modelId: "a320neo",
  status: "idle",
  assignedRouteId: "r1",
  baseAirportIata: "MAD",
  line: null,
} as unknown as AircraftInstance;

afterEach(() => {
  cleanup();
  setAircraftLine.mockClear();
});

describe("LineSection", () => {
  it("invites a day plan, auto-fills it from the base and saves it", async () => {
    render(<LineSection aircraft={plane} />);
    expect(screen.getByTestId("aircraft-duty")).toHaveTextContent("Flies MAD ⇄ BCN back and forth");
    expect(screen.getByText(/A day plan replaces its single route/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("line-open"));
    expect(screen.getByRole("dialog")).toHaveTextContent("A day from MAD");
    expect(screen.getByTestId("line-save")).toBeDisabled();
    fireEvent.click(screen.getByTestId("line-autofill"));
    expect(screen.getByTestId("line-status")).toHaveTextContent(/Back at MAD at \d\d:\d\dZ/);
    expect(screen.getAllByTestId("line-board-leg").length).toBeGreaterThanOrEqual(6);
    fireEvent.click(screen.getByTestId("line-save"));
    await waitFor(() => expect(setAircraftLine).toHaveBeenCalledTimes(1));
    const [, legs] = setAircraftLine.mock.calls[0] as unknown as [string, { routeId: string }[]];
    expect(legs.length % 2).toBe(0);
  });

  it("builds a line leg by leg and says when it does not come home", () => {
    render(<LineSection aircraft={plane} />);
    fireEvent.click(screen.getByTestId("line-open"));
    fireEvent.change(screen.getByTestId("line-add"), { target: { value: "r1:outbound" } });
    expect(screen.getByTestId("line-status")).toHaveTextContent(/back to MAD/);
    fireEvent.change(screen.getByTestId("line-add"), { target: { value: "r1:inbound" } });
    expect(screen.getByTestId("line-status")).toHaveTextContent(/Back at MAD/);
    expect(screen.getByTestId("line-save")).toBeEnabled();
  });

  it("shows an existing line on the board", () => {
    const lined = {
      ...plane,
      assignedRouteId: null,
      line: {
        startTick: 0,
        legs: [
          {
            routeId: "r1",
            originIata: "MAD",
            destinationIata: "BCN",
            departOffsetTicks: 7 * 1200,
            durationTicks: 1300,
            turnaroundTicks: 800,
          },
          {
            routeId: "r1",
            originIata: "BCN",
            destinationIata: "MAD",
            departOffsetTicks: 10 * 1200,
            durationTicks: 1300,
            turnaroundTicks: 800,
          },
        ],
      },
    } as unknown as AircraftInstance;
    render(<LineSection aircraft={lined} />);
    expect(screen.getByTestId("line-route")).toHaveTextContent("MAD→BCN→MAD");
    expect(screen.getAllByTestId("line-board-leg")).toHaveLength(2);
    expect(screen.getByTestId("line-open")).toHaveTextContent(/Edit day plan/);
    expect(screen.getByTestId("line-repeats")).toHaveTextContent(/every day/);
    expect(screen.queryByTestId("aircraft-duty")).toBeNull();
  });

  it("says a plane with nothing to fly is parked", () => {
    render(<LineSection aircraft={{ ...plane, assignedRouteId: null } as AircraftInstance} />);
    expect(screen.getByTestId("aircraft-duty")).toHaveTextContent("Parked at MAD");
  });
});
