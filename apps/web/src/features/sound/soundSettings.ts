import { useSyncExternalStore } from "react";

/** Per-device sound switch (S76), persisted in localStorage. Off by default. */
const KEY = "acars_sound_enabled";

const storage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

let current: boolean | null = null;
const listeners = new Set<() => void>();

export function getSoundEnabled(): boolean {
  current ??= storage()?.getItem(KEY) === "on";
  return current;
}

export function setSoundEnabled(enabled: boolean): void {
  current = enabled;
  try {
    storage()?.setItem(KEY, enabled ? "on" : "off");
  } catch {
    // Private mode or full storage: the switch still works for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSoundEnabled, getSoundEnabled);
}

/** Forget the in-memory copy (tests). */
export function resetSoundCache(): void {
  current = null;
}
