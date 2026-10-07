import { airlineNpub, parseAirlineKey } from "@/features/airline/utils/airlineKey";

/** Where the first referrer seen on this device is kept (S51). */
export const REFERRAL_STORAGE_KEY = "acars:referrer";

/** localStorage, or null where it's blocked (it throws on access in some privacy modes). */
export function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Remembers the referrer from a `?ref=<npub|hex>` link. First touch wins:
 * a later link doesn't replace an earlier one. Never throws.
 */
export function captureReferral(search: string, storage: WriteStorage | null): void {
  try {
    const ref = new URLSearchParams(search).get("ref");
    const pubkey = parseAirlineKey(ref);
    if (!pubkey || !storage || storage.getItem(REFERRAL_STORAGE_KEY)) return;
    storage.setItem(REFERRAL_STORAGE_KEY, pubkey);
  } catch {
    // Storage blocked: no attribution, nothing else lost.
  }
}

/** The stored referrer (hex), unless it's the player themself. */
export function readReferral(storage: ReadStorage | null, ownPubkey: string | null): string | null {
  try {
    const pubkey = parseAirlineKey(storage?.getItem(REFERRAL_STORAGE_KEY));
    return pubkey && pubkey !== ownPubkey ? pubkey : null;
  } catch {
    return null;
  }
}

/** A link to `path` that credits `pubkey` as the referrer. */
export function withReferral(url: string, pubkey: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}ref=${airlineNpub(pubkey)}`;
}
