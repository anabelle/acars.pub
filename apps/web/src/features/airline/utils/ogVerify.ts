/**
 * Authenticity gate for checkpoint events read by the link-preview Pages
 * Functions (S50). Relays are untrusted transport: a relay can answer a
 * subscription with any JSON it likes. Only events that carry a valid
 * Nostr signature, are authored by the requested airline and have the
 * checkpoint kind may feed its preview. Kept separate from ogMeta.ts so
 * that file stays dependency-free.
 */
import { verifyEvent } from "nostr-tools/pure";
import { CHECKPOINT_KIND } from "./ogMeta";

/** Upper bound on events verified per relay answer (we ask for 3). */
export const MAX_VERIFIED_EVENTS = 10;

export interface UnverifiedRelayEvent {
  id?: unknown;
  pubkey?: unknown;
  kind?: unknown;
  sig?: unknown;
  created_at: number;
  content: string;
  tags: string[][];
}

/** Keep only signed checkpoint events authored by `pubkey`. */
export function authenticCheckpointEvents<T extends UnverifiedRelayEvent>(
  events: readonly T[],
  pubkey: string,
): T[] {
  const out: T[] = [];
  for (const event of events.slice(0, MAX_VERIFIED_EVENTS)) {
    if (!event || typeof event !== "object") continue;
    if (event.pubkey !== pubkey || event.kind !== CHECKPOINT_KIND) continue;
    if (!Array.isArray(event.tags) || typeof event.content !== "string") continue;
    try {
      // Verify a fresh plain copy: nostr-tools caches a "verified" flag on
      // the object it is given, so never trust flags riding on input.
      // verifyEvent recomputes the event id from these fields and checks
      // the Schnorr signature over it.
      const plain = {
        id: event.id,
        pubkey: event.pubkey,
        kind: event.kind,
        created_at: event.created_at,
        tags: event.tags,
        content: event.content,
        sig: event.sig,
      } as unknown as Parameters<typeof verifyEvent>[0];
      if (verifyEvent(plain)) out.push(event);
    } catch {
      // malformed event — drop
    }
  }
  return out;
}
