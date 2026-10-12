/** Letters and digits a registration uses (no I or O, as on real aircraft). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

/**
 * A short, stable registration for a plane ("AC-K7QDM"), derived from its id
 * so every player sees the same one. The id itself stays the plane's key.
 */
export function registrationFor(aircraftId: string): string {
  // FNV-1a, 32-bit: deterministic on every runtime.
  let hash = 0x811c9dc5;
  for (let i = 0; i < aircraftId.length; i++) {
    hash ^= aircraftId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let mark = "";
  for (let i = 0; i < 5; i++) {
    mark += ALPHABET[hash % ALPHABET.length];
    hash = Math.floor(hash / ALPHABET.length);
  }
  return `AC-${mark}`;
}
