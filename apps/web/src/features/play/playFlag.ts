/**
 * Feature flag for the globe-first `/play` prototype (S45). Off by default.
 * On with `VITE_PLAY_PROTOTYPE=1` at build time, or per browser by opening
 * `/play?prototype=on` (`?prototype=off` turns it back off).
 */
export const PLAY_PROTOTYPE_STORAGE_KEY = "acars_play_prototype";

type FlagStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): FlagStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Applies a `?prototype=on|off` toggle, then reports whether the prototype is on. */
export function resolvePlayPrototypeFlag(
  search: string,
  {
    buildFlag = import.meta.env.VITE_PLAY_PROTOTYPE,
    storage = browserStorage(),
  }: { buildFlag?: string; storage?: FlagStorage | null } = {},
): boolean {
  const toggle = new URLSearchParams(search).get("prototype");
  try {
    if (toggle === "on") storage?.setItem(PLAY_PROTOTYPE_STORAGE_KEY, "1");
    if (toggle === "off") storage?.removeItem(PLAY_PROTOTYPE_STORAGE_KEY);
  } catch {
    // Blocked storage: the toggle only lasts for this page view.
  }
  if (toggle === "on") return true;
  if (toggle === "off") return false;
  if (buildFlag === "1") return true;
  try {
    return storage?.getItem(PLAY_PROTOTYPE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
