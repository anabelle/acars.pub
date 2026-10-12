import type { WeatherFactors } from "@acars/core";
import { GENESIS_TIME, TICK_DURATION } from "@acars/core";
import { tickHourKey, useEngineStore, useWeatherStore } from "@acars/store";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AirportWeather } from "./AirportWeather";
import { WeatherBridge } from "./WeatherBridge";
import { weatherPubkey } from "./weatherKey";

const KEY = "e".repeat(64);
const storm: WeatherFactors = {
  category: 2,
  gustKt: 38,
  thunderstorm: true,
  fog: false,
  snow: false,
};
const tick = (Date.UTC(2026, 9, 12, 14, 30) - GENESIS_TIME) / TICK_DURATION;

afterEach(() => {
  cleanup();
  localStorage.clear();
  useWeatherStore.setState({ hours: new Map() });
});

describe("weather key", () => {
  it("is empty unless a valid hex key is configured", () => {
    expect(weatherPubkey()).toBe("");
    localStorage.setItem("acars_weather_pubkey", "nope");
    expect(weatherPubkey()).toBe("");
    localStorage.setItem("acars_weather_pubkey", KEY);
    expect(weatherPubkey()).toBe(KEY);
  });
});

describe("WeatherBridge", () => {
  it("does nothing without a key, and stores bundles with one", async () => {
    const load = vi.fn(
      async () =>
        new Map([
          [
            "2026101214",
            { hourKey: "2026101214", issuedAtMs: 0, airports: new Map([["DFW", storm]]) },
          ],
        ]),
    );
    const { unmount } = render(<WeatherBridge load={load} />);
    expect(load).not.toHaveBeenCalled();
    unmount();
    localStorage.setItem("acars_weather_pubkey", KEY);
    render(<WeatherBridge load={load} />);
    await waitFor(() =>
      expect(useWeatherStore.getState().hours.get("2026101214")?.get("DFW")).toEqual(storm),
    );
    expect(load).toHaveBeenCalledWith(KEY, expect.any(Number), 3);
  });
});

describe("AirportWeather", () => {
  it("shows the hour's weather and what it does to departures", () => {
    act(() => {
      useEngineStore.setState({ tick } as never);
      useWeatherStore
        .getState()
        .setHours(new Map([[tickHourKey(tick), new Map([["DFW", storm]])]]));
    });
    render(<AirportWeather iata="DFW" />);
    expect(screen.getByTestId("airport-weather")).toHaveTextContent("IFR · TS · G38");
    expect(screen.getByTestId("airport-weather")).toHaveTextContent(/expect delays/);
  });

  it("is silent where no report exists", () => {
    act(() => useEngineStore.setState({ tick } as never));
    render(<AirportWeather iata="MAD" />);
    expect(screen.queryByTestId("airport-weather")).toBeNull();
  });
});
