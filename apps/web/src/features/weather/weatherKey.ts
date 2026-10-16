/**
 * The world's weather key (S68, D11): bundles signed by it are the only
 * weather the game believes. Set at build time (VITE_WEATHER_PUBKEY, hex);
 * `localStorage.acars_weather_pubkey` overrides it for testing. Empty: calm.
 */
export function weatherPubkey(): string {
  let override: string;
  try {
    override = window.localStorage.getItem("acars_weather_pubkey") ?? "";
  } catch {
    override = "";
  }
  const key = override || (import.meta.env.VITE_WEATHER_PUBKEY as string | undefined) || "";
  return /^[0-9a-f]{64}$/.test(key) ? key : "";
}
