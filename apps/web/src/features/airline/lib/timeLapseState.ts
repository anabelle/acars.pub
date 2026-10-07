import { useSyncExternalStore } from "react";
import type { TimeLapse } from "@/features/airline/utils/timeLapse";

/**
 * The time-lapse playing on the map, if any (S55.3). The away report starts
 * it and the map plays it; a module-level store keeps the two decoupled.
 */
let current: TimeLapse | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export function playTimeLapse(lapse: TimeLapse): void {
  current = lapse;
  emit();
}

export function stopTimeLapse(): void {
  if (current === null) return;
  current = null;
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => current;

export function useTimeLapse(): TimeLapse | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
