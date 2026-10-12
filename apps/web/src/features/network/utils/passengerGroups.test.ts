import { setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { beforeAll, describe, expect, it } from "vitest";
import { destinationEconomyElasticity, destinationMix } from "./passengerGroups";

beforeAll(() => {
  setAirportsCatalog(airports);
});

describe("destination passenger mix (S71)", () => {
  it("reads the mix from the destination's tag", () => {
    expect(destinationMix("TFS").leisure).toBe(0.7);
    expect(destinationMix("LHR").business).toBe(0.45);
    expect(destinationMix("ZZZ")).toEqual(destinationMix("PMI"));
  });

  it("gives holiday routes a more price-sensitive economy cabin", () => {
    expect(destinationEconomyElasticity("TFS")).toBe(-1.37);
    expect(destinationEconomyElasticity("LHR")).toBe(-0.925);
  });
});
