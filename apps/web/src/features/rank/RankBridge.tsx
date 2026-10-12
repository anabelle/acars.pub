import { loadRankProofs } from "@acars/nostr";
import { useAirlineStore, useRankStore } from "@acars/store";
import { useEffect } from "react";

const REFRESH_MS = 10 * 60_000;

/**
 * Keeps rank proofs (S72) for the player and every rival in the store,
 * refreshed every 10 minutes. Until the first load nobody is floored.
 */
export function RankBridge({ load = loadRankProofs }: { load?: typeof loadRankProofs }) {
  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      const { competitors, pubkey } = useAirlineStore.getState();
      const keys = [...competitors.values()].map((airline) => airline.ceoPubkey);
      if (pubkey) keys.push(pubkey);
      if (keys.length === 0) return;
      try {
        const ranked = await load(keys);
        if (!stopped) useRankStore.getState().setRanked(ranked, pubkey);
      } catch (error) {
        console.warn("[rank] load failed", error);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    // The player's key and the rivals arrive after mount: load again when they do.
    let seen = `${useAirlineStore.getState().pubkey}:${useAirlineStore.getState().competitors.size}`;
    const unsubscribe = useAirlineStore.subscribe((state) => {
      const now = `${state.pubkey}:${state.competitors.size}`;
      if (now !== seen) {
        seen = now;
        void refresh();
      }
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      unsubscribe();
    };
  }, [load]);
  return null;
}
