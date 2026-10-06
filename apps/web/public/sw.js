/*
 * ACARS service worker (S34): the app shell keeps working offline.
 *
 * - Page loads: network first; offline they fall back to the cached shell
 *   (the SPA shell, cached as "/"), which then boots from the locally
 *   persisted airline state.
 * - Hashed build assets (/assets/*): cache first. Their names change with
 *   their content, so a cached copy is never stale. The cache is capped.
 * - Other same-origin static files (icons, manifest, maplibre worker):
 *   served from cache when present, refreshed in the background.
 * - Never touched: non-GET requests, /api/* (Pages Functions), relays and
 *   any cross-origin request (basemap tiles, Blossom images).
 *
 * It also handles taps on system notifications (focus or open the app).
 *
 * Plain JS on purpose: it is served as-is from public/ at the site root so
 * its scope covers the whole app.
 */

const SHELL_CACHE = "acars-shell-v1";
const ASSET_CACHE = "acars-assets-v1";
const STATIC_CACHE = "acars-static-v1";
const CACHES = [SHELL_CACHE, ASSET_CACHE, STATIC_CACHE];
const SHELL_URL = "/";
const MAX_ASSETS = 150;
const PRECACHE = [SHELL_URL, "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png"];

/** Which strategy a request gets, or null to leave it to the network. */
function routeFor(request, origin) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.origin !== origin) return null;
  if (url.pathname.startsWith("/api/")) return null;
  if (request.mode === "navigate") return "page";
  if (url.pathname.startsWith("/assets/")) return "asset";
  return "static";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !CACHES.includes(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  // Oldest first (insertion order); drop the overflow.
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)),
  );
}

async function page(request) {
  try {
    const response = await fetch(request);
    // Keep the newest shell for offline use (only the SPA shell itself).
    if (response.ok && !response.redirected && new URL(request.url).pathname === "/") {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(SHELL_URL);
    if (cached) return cached;
    throw error;
  }
}

async function asset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
    trimAssets();
  }
  return response;
}

async function staticFile(request, event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const response = await refresh;
  return response ?? (await caches.match(request)) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const route = routeFor(event.request, self.location.origin);
  if (route === "page") event.respondWith(page(event.request));
  else if (route === "asset") event.respondWith(asset(event.request));
  else if (route === "static") event.respondWith(staticFile(event.request, event));
});

// Notifications (S34): a tap focuses an open ACARS window, or opens one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      return open ? open.focus() : self.clients.openWindow("/");
    }),
  );
});
