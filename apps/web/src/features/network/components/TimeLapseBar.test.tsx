import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimeLapse } from "@/features/airline/utils/timeLapse";
import i18n from "@/i18n";
import { TimeLapseBar } from "./TimeLapseBar";

const lapse: TimeLapse = {
  legs: [
    {
      id: "a",
      aircraftId: "ac1",
      originIata: "MAD",
      destinationIata: "BCN",
      departureTick: 0,
      arrivalTick: 1_200,
    },
    {
      id: "b",
      aircraftId: "ac1",
      originIata: "BCN",
      destinationIata: "MAD",
      departureTick: 1_500,
      arrivalTick: 2_700,
    },
  ],
  startTick: 0,
  endTick: 2_700,
  // 2 h 15 min in 30 s.
  speed: 270,
  durationMs: 30_000,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  await i18n.changeLanguage("en");
});

describe("TimeLapseBar", () => {
  it("follows the replay: speed, flights landed and progress", () => {
    const elapsed = { current: 0 };
    render(<TimeLapseBar lapse={lapse} elapsed={elapsed} onClose={() => {}} />);
    const bar = screen.getByTestId("time-lapse-bar");
    expect(bar).toHaveTextContent("×270");
    expect(bar).toHaveTextContent("0 of 2 flights landed");

    // Halfway: the first flight (landed after 1 h of replayed time) is down.
    elapsed.current = 15_000;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(bar).toHaveAttribute("data-landed", "1");
    expect(bar).toHaveTextContent("1 of 2 flights landed");

    elapsed.current = 40_000;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(bar).toHaveTextContent("2 of 2 flights landed");
  });

  it("stops from the button and with Escape", () => {
    const onClose = vi.fn();
    render(<TimeLapseBar lapse={lapse} elapsed={{ current: 0 }} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop the replay" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders in Spanish", async () => {
    await i18n.changeLanguage("es");
    render(<TimeLapseBar lapse={lapse} elapsed={{ current: 0 }} onClose={() => {}} />);
    expect(screen.getByText("0 de 2 vuelos aterrizados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parar la repetición" })).toBeInTheDocument();
  });
});
