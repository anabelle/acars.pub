import { loadWeatherBundles } from "@acars/nostr";
import { useWeatherStore } from "@acars/store";
import { useEffect } from "react";
import { weatherPubkey } from "./weatherKey";

const REFRESH_MS = 10 * 60_000;

/**
 * Keeps the last hours of weather bundles (S68) in the store, refreshed
 * every 10 minutes, when the world has a weather key. Silent otherwise.
 */
export function WeatherBridge({ load = loadWeatherBundles }: { load?: typeof loadWeatherBundles }) {
  useEffect(() => {
    const key = weatherPubkey();
    if (!key) return;
    let stopped = false;
    const refresh = async () => {
      try {
        const bundles = await load(key, Date.now(), 3);
        if (stopped || bundles.size === 0) return;
        useWeatherStore
          .getState()
          .setHours(new Map([...bundles].map(([hour, bundle]) => [hour, bundle.airports])));
      } catch (error) {
        console.warn("[weather] load failed", error);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [load]);
  return null;
}
