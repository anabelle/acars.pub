/// <reference types="vite/client" />
/**
 * Registers the app-shell service worker (public/sw.js, S34) in production
 * builds, after load so it never competes with startup. If the page has
 * already loaded (main.tsx awaits i18n first), it registers right away.
 * Returns whether a registration was attempted.
 */
export function registerServiceWorker(
  options: {
    production?: boolean;
    navigatorLike?: Pick<Navigator, "serviceWorker"> | undefined;
    windowLike?: Pick<Window, "addEventListener">;
    documentLike?: Pick<Document, "readyState">;
  } = {},
): boolean {
  const production = options.production ?? import.meta.env.PROD;
  const nav = options.navigatorLike ?? (typeof navigator === "undefined" ? undefined : navigator);
  const win = options.windowLike ?? (typeof window === "undefined" ? undefined : window);
  const doc = options.documentLike ?? (typeof document === "undefined" ? undefined : document);
  if (!production || !nav || !("serviceWorker" in nav) || !nav.serviceWorker || !win) return false;
  const register = () => {
    nav.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch((error: unknown) => {
      console.warn("[sw] registration failed", error);
    });
  };
  if (doc?.readyState === "complete") register();
  else win.addEventListener("load", register);
  return true;
}

const STALE_RELOAD_KEY = "acars:stale-chunk-reload";
const STALE_RELOAD_WINDOW_MS = 60_000;

/**
 * After a deploy, a page loaded before it asks for files that no longer
 * exist and Vite fires `vite:preloadError`. Reload once to pick up the new
 * build; if that happened within the last minute, let the error surface
 * instead of reloading in a loop.
 */
export function reloadOnStaleChunks(
  options: {
    windowLike?: Pick<Window, "addEventListener">;
    storage?: Pick<Storage, "getItem" | "setItem">;
    reload?: () => void;
    now?: () => number;
  } = {},
): void {
  const win = options.windowLike ?? (typeof window === "undefined" ? undefined : window);
  if (!win) return;
  const now = options.now ?? Date.now;
  const reload = options.reload ?? (() => window.location.reload());
  win.addEventListener("vite:preloadError", (event) => {
    let storage = options.storage;
    try {
      storage ??= window.sessionStorage;
      const last = Number(storage.getItem(STALE_RELOAD_KEY) ?? 0);
      if (now() - last < STALE_RELOAD_WINDOW_MS) return;
      storage.setItem(STALE_RELOAD_KEY, String(now()));
    } catch {
      return; // No storage: a reload could loop, so let the error show.
    }
    event.preventDefault();
    reload();
  });
}
