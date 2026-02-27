import { ensureConnected, getNDK } from "@acars/nostr";
import type { NDKUserProfile } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { useEffect, useState } from "react";

export interface NostrProfileState {
  name: string | null;
  displayName: string | null;
  image: string | null;
  nip05: string | null;
  lud16: string | null;
  npub: string | null;
  isLoading: boolean;
}

const profileCache = new Map<string, NDKUserProfile | null>();
const pendingFetches = new Map<string, Promise<NDKUserProfile | null>>();

const getProfileImage = (profile: NDKUserProfile | null | undefined) => {
  if (!profile) return null;
  const rawProfile = profile as NDKUserProfile & { picture?: string };
  return profile.image ?? rawProfile.picture ?? null;
};

const fetchProfile = async (pubkey: string): Promise<NDKUserProfile | null> => {
  try {
    await ensureConnected();
    const ndk = getNDK();
    const user = ndk.getUser({ pubkey });
    const profile = await user.fetchProfile();
    profileCache.set(pubkey, profile);
    return profile;
  } catch {
    profileCache.set(pubkey, null);
    return null;
  } finally {
    pendingFetches.delete(pubkey);
  }
};

export function useNostrProfile(pubkey: string | null): NostrProfileState {
  const [state, setState] = useState<{
    profile: NDKUserProfile | null;
    isLoading: boolean;
    pubkey: string | null;
  }>(() => {
    if (!pubkey) {
      return { profile: null, isLoading: false, pubkey };
    }
    const cached = profileCache.get(pubkey);
    if (cached !== undefined) {
      return { profile: cached, isLoading: false, pubkey };
    }
    return { profile: null, isLoading: true, pubkey };
  });

  // Derived state synchronization (React docs recommended approach)
  if (pubkey !== state.pubkey) {
    if (!pubkey) {
      setState({ profile: null, isLoading: false, pubkey });
    } else {
      const cached = profileCache.get(pubkey);
      if (cached !== undefined) {
        setState({ profile: cached, isLoading: false, pubkey });
      } else {
        setState({ profile: null, isLoading: true, pubkey });
      }
    }
  }

  useEffect(() => {
    if (!pubkey) return;

    const cached = profileCache.get(pubkey);
    if (cached !== undefined) return;

    let active = true;

    let pending = pendingFetches.get(pubkey);
    if (!pending) {
      pending = fetchProfile(pubkey);
      pendingFetches.set(pubkey, pending);
    }

    pending.then((fetched) => {
      if (!active) return;
      setState((prev) => {
        // Only update if the pubkey hasn't changed since we started fetching
        if (prev.pubkey !== pubkey) return prev;
        return { ...prev, profile: fetched, isLoading: false };
      });
    });

    return () => {
      active = false;
    };
  }, [pubkey]);

  return {
    name: state.profile?.name ?? null,
    displayName: state.profile?.displayName ?? null,
    image: getProfileImage(state.profile),
    nip05: state.profile?.nip05 ?? null,
    lud16: state.profile?.lud16 ?? null,
    npub: pubkey ? getNpub(pubkey) : null,
    isLoading: state.isLoading,
  };
}

function getNpub(pubkey: string): string | null {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return null;
  }
}
