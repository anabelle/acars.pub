import { create } from "zustand";

export type RankStatus = "unknown" | "unranked" | "mining" | "publishing" | "ranked" | "failed";

interface RankState {
  /** Airlines (pubkeys) holding a valid rank proof (S72). */
  ranked: ReadonlySet<string>;
  /** False until the first load: until then nobody is floored. */
  loaded: boolean;
  /** The player's own rank, and mining progress (hashes tried). */
  status: RankStatus;
  hashes: number;
  setRanked: (pubkeys: Iterable<string>, me?: string | null) => void;
  setStatus: (status: RankStatus, hashes?: number) => void;
}

/** Ranked airlines (S72): the client loads proofs; the engine reads them. */
export const useRankStore = create<RankState>((set) => ({
  ranked: new Set(),
  loaded: false,
  status: "unknown",
  hashes: 0,
  setRanked: (pubkeys, me) =>
    set((state) => {
      const ranked = new Set(state.ranked);
      for (const key of pubkeys) ranked.add(key);
      const status =
        me && ranked.has(me)
          ? "ranked"
          : state.status === "unknown" && me
            ? "unranked"
            : state.status;
      return { ranked, loaded: true, status };
    }),
  setStatus: (status, hashes) => set((state) => ({ status, hashes: hashes ?? state.hashes })),
}));

/**
 * Whether an airline counts as ranked for market share: everyone does until
 * proofs have loaded once (so a slow relay doesn't floor every rival).
 */
export function isRankedAirline(pubkey: string): boolean {
  const { loaded, ranked } = useRankStore.getState();
  return !loaded || ranked.has(pubkey);
}

let mining: AbortController | null = null;

/**
 * Mine and publish the player's rank proof (S72): a few seconds of work in
 * the page, once. Resolves true when ranked; cancel with `cancelRankMining`.
 */
export async function getRanked(pubkey: string, createdAtSec = Math.floor(Date.now() / 1000)) {
  const store = useRankStore.getState();
  if (store.status === "mining" || store.status === "publishing" || store.status === "ranked") {
    return store.status === "ranked";
  }
  mining = new AbortController();
  store.setStatus("mining", 0);
  try {
    const { mineRankProof, publishRankProof, rankTemplate } = await import("@acars/nostr");
    const mined = await mineRankProof(rankTemplate(pubkey, createdAtSec), {
      signal: mining.signal,
      onProgress: (hashes) => useRankStore.getState().setStatus("mining", hashes),
    });
    useRankStore.getState().setStatus("publishing");
    await publishRankProof(mined);
    useRankStore.getState().setRanked([pubkey], pubkey);
    return true;
  } catch (error) {
    const cancelled = error instanceof Error && error.name === "AbortError";
    useRankStore.getState().setStatus(cancelled ? "unranked" : "failed");
    if (!cancelled) console.error("[Rank] could not get ranked", error);
    return false;
  } finally {
    mining = null;
  }
}

export function cancelRankMining(): void {
  mining?.abort();
}
