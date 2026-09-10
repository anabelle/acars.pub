import { describe, expect, it } from "vitest";
import {
  getAirports,
  isDataCatalogReady,
  setAirportsCatalog,
  whenDataCatalogReady,
} from "./catalog.js";

const fakeAirport = {
  id: "1",
  iata: "TST",
  icao: "TST1",
  name: "Test Airport",
  latitude: 0,
  longitude: 0,
} as const;

describe("airports catalog registry", () => {
  it("throws a descriptive error before the catalog is loaded", () => {
    expect(isDataCatalogReady()).toBe(false);
    expect(() => getAirports()).toThrow(/whenDataCatalogReady/);
  });

  it("loads the real catalog via whenDataCatalogReady (memoized)", async () => {
    const first = await whenDataCatalogReady();
    expect(first.length).toBeGreaterThan(1000);
    expect(isDataCatalogReady()).toBe(true);
    expect(getAirports()).toBe(first);

    const second = await whenDataCatalogReady();
    expect(second).toBe(first);
  });

  it("setAirportsCatalog overrides the registry contents", () => {
    setAirportsCatalog([fakeAirport]);
    expect(isDataCatalogReady()).toBe(true);
    expect(getAirports()).toEqual([fakeAirport]);
  });
});
