import { useEffect, useState } from "react";

type Loader = (pubkey: string) => Promise<Set<string>>;

const defaultLoad: Loader = async (pubkey) => (await import("@acars/nostr")).loadFollows(pubkey);

/**
 * The people a player follows (S74, NIP-02), loaded once when `enabled`
 * first turns on; null while loading (or when off).
 */
export function useFollows(
  pubkey: string | null,
  enabled: boolean,
  load: Loader = defaultLoad,
): Set<string> | null {
  const [follows, setFollows] = useState<{ key: string; set: Set<string> } | null>(null);
  useEffect(() => {
    if (!enabled || !pubkey || follows?.key === pubkey) return;
    let cancelled = false;
    load(pubkey)
      .catch(() => new Set<string>())
      .then((set) => {
        if (!cancelled) setFollows({ key: pubkey, set });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, pubkey, follows, load]);
  return enabled && follows && follows.key === pubkey ? follows.set : null;
}
