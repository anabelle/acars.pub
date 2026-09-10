// NOTE: the large airports catalog is deliberately NOT re-exported here.
// Importing the barrel must stay light (helpers + small catalogs only) so the
// web entry bundle does not inline the ~6k-airport list. Load it async via
// `whenDataCatalogReady()` / read it via `getAirports()` from `./catalog.js`,
// or import the array directly from the `@acars/data/airports` subpath.
export * from "./aircraft.js";
export * from "./catalog.js";
export * from "./geo.js";
export * from "./hubs.js";
