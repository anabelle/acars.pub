import { describe, expect, it } from "vitest";
import { airports } from "./airports.js";

describe("airports data", () => {
  it("contains airport entries", () => {
    expect(airports.length).toBeGreaterThan(1000);
  });

  it("includes required fields on sampled airports", () => {
    const sample = airports.slice(0, 10);
    for (const airport of sample) {
      expect(airport.id).toBeTruthy();
      expect(airport.name).toBeTruthy();
      expect(airport.iata).toBeTruthy();
      expect(airport.latitude).toBeTypeOf("number");
      expect(airport.longitude).toBeTypeOf("number");
      expect(airport.country).toBeTruthy();
    }
  });
});
