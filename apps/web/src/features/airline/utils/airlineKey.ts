import { nip19 } from "nostr-tools";

const HEX_PUBKEY = /^[0-9a-f]{64}$/i;

/** Hex pubkey from an `/airline/$npub` param (npub or 64-char hex), or null. */
export function parseAirlineKey(param: string | null | undefined): string | null {
  const value = param?.trim();
  if (!value) return null;
  if (HEX_PUBKEY.test(value)) return value.toLowerCase();
  if (!value.startsWith("npub1")) return null;
  try {
    const decoded = nip19.decode(value);
    return decoded.type === "npub" ? decoded.data : null;
  } catch {
    return null;
  }
}

/** npub for a hex pubkey; falls back to the input if it can't be encoded. */
export function airlineNpub(pubkey: string): string {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
}

/** The shareable path for an airline (npub form). */
export function airlinePath(pubkey: string): string {
  return `/airline/${airlineNpub(pubkey)}`;
}
