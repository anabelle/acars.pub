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
    nav.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.warn("[sw] registration failed", error);
    });
  };
  if (doc?.readyState === "complete") register();
  else win.addEventListener("load", register);
  return true;
}
