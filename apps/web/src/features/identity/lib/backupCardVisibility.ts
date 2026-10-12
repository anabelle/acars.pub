import { useSyncExternalStore } from "react";

/**
 * Whether the "Keep your airline" card is on screen, so the standing banner
 * steps aside while it is: one key-backup prompt at a time, never two.
 */
let open = false;
const listeners = new Set<() => void>();

export function setBackupCardOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBackupCardOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
