import type { NDKEvent, NDKFilter } from "@nostr-dev-kit/ndk";
import { ensureConnected, getNDK } from "./ndk.js";
import {
  parseWeatherEvent,
  WEATHER_KIND,
  type WeatherBundle,
  weatherDTag,
  weatherHourKey,
} from "./weatherBundle.js";

/**
 * The last `hours` weather bundles (S68) from the world's weather key, by
 * hour key. Bundles from anyone else, or malformed, are ignored; hours with
 * no bundle are simply absent (calm).
 */
export async function loadWeatherBundles(
  weatherPubkey: string,
  nowMs: number,
  hours = 3,
): Promise<Map<string, WeatherBundle>> {
  const bundles = new Map<string, WeatherBundle>();
  if (!/^[0-9a-f]{64}$/.test(weatherPubkey)) return bundles;
  await ensureConnected();
  const ndk = getNDK();
  const keys = Array.from({ length: hours }, (_, i) => weatherHourKey(nowMs - i * 3_600_000));
  const filter: NDKFilter = {
    kinds: [WEATHER_KIND],
    authors: [weatherPubkey],
    "#d": keys.map(weatherDTag),
  };
  await new Promise<void>((resolve) => {
    const sub = ndk.subscribe(filter, { closeOnEose: true });
    const timeout = setTimeout(() => {
      sub.stop();
      resolve();
    }, 6000);
    sub.on("event", (event: NDKEvent) => {
      const bundle = parseWeatherEvent(event.rawEvent(), weatherPubkey);
      const existing = bundle ? bundles.get(bundle.hourKey) : undefined;
      if (bundle && (!existing || bundle.issuedAtMs > existing.issuedAtMs)) {
        bundles.set(bundle.hourKey, bundle);
      }
    });
    sub.on("eose", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  return bundles;
}
