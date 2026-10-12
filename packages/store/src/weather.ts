import type { WeatherFactors } from "@acars/core";
import { GENESIS_TIME, TICK_DURATION } from "@acars/core";
import { create } from "zustand";

/** "YYYYMMDDHH" (UTC) for a tick — the hour key weather bundles use (S68). */
export function tickHourKey(tick: number): string {
  const d = new Date(GENESIS_TIME + tick * TICK_DURATION);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;
}

interface WeatherState {
  /** Hour key → airport → factors, from the world weather key's bundles. */
  hours: Map<string, ReadonlyMap<string, WeatherFactors>>;
  setHours: (hours: ReadonlyMap<string, ReadonlyMap<string, WeatherFactors>>) => void;
}

/** Recent weather bundles (S68): the client loads them; the engine reads them. */
export const useWeatherStore = create<WeatherState>((set) => ({
  hours: new Map(),
  setHours: (hours) =>
    set((state) => {
      const next = new Map(state.hours);
      for (const [key, airports] of hours) next.set(key, airports);
      // Keep the last two days of bundles at most (a catch-up can span a day).
      const keys = [...next.keys()].sort();
      for (const key of keys.slice(0, Math.max(0, keys.length - 48))) next.delete(key);
      return { hours: next };
    }),
}));

/**
 * Weather at an airport for a tick: the bundle of that UTC hour, or nothing
 * (calm) when no bundle arrived. Every client with the same bundles agrees.
 */
export function weatherAt(iata: string, tick: number): WeatherFactors | null {
  return useWeatherStore.getState().hours.get(tickHourKey(tick))?.get(iata) ?? null;
}
