import type { Airport } from "@acars/core";

/**
 * Async airports-catalog registry.
 *
 * The full airports catalog (~6k entries, >1MB) is intentionally NOT
 * re-exported from the package barrel so that static importers of
 * `@acars/data` (helpers, types, small catalogs) do not pull it into their
 * entry bundle. Consumers load it lazily via `whenDataCatalogReady()`
 * (kick it off right after first paint) and then access it synchronously
 * through `getAirports()`.
 */

let catalog: Airport[] | null = null;
let readyPromise: Promise<Airport[]> | null = null;

/** Seed the registry directly (useful for tests or preloaded bundles). */
export function setAirportsCatalog(list: Airport[]): void {
  catalog = list;
}

/**
 * Synchronous access to the airports catalog. Throws if the catalog has not
 * been loaded yet — callers in the entry path must await
 * `whenDataCatalogReady()` first. Failing loudly (instead of returning an
 * empty list) keeps the deterministic engine from ever running silently
 * against an empty catalog.
 */
export function getAirports(): Airport[] {
  if (!catalog) {
    throw new Error(
      "@acars/data: airports catalog not loaded yet — await whenDataCatalogReady() before calling getAirports()",
    );
  }
  return catalog;
}

/** Whether the airports catalog has been loaded into the registry. */
export function isDataCatalogReady(): boolean {
  return catalog !== null;
}

/**
 * Load the airports catalog via a memoized dynamic import of the
 * `./airports.js` subpath (which the bundler splits into an async chunk).
 * Repeated calls return the same promise; resolves with the catalog list.
 */
export function whenDataCatalogReady(): Promise<Airport[]> {
  if (catalog) return Promise.resolve(catalog);
  if (!readyPromise) {
    readyPromise = import("./airports.js").then((mod) => {
      if (!catalog) catalog = mod.airports;
      return catalog;
    });
  }
  return readyPromise;
}
