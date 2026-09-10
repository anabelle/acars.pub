import { describe, expect, it } from "vitest";
import type { AircraftInstance } from "@acars/core";
import {
  __resetWorldFleetIndexCacheForTests,
  getWorldFleetAtAirport,
  getWorldFleetByAirport,
} from "./worldFleetIndex";

function makeAircraft(
  id: string,
  ownerPubkey: string,
  baseAirportIata: string,
  flight?: { originIata: string; destinationIata: string },
): AircraftInstance {
  return {
    id,
    ownerPubkey,
    baseAirportIata,
    status: flight ? "enroute" : "idle",
    flight: flight
      ? ({
          originIata: flight.originIata,
          destinationIata: flight.destinationIata,
          departureTick: 0,
          arrivalTick: 10,
        } as AircraftInstance["flight"])
      : null,
  } as unknown as AircraftInstance;
}

describe("worldFleetIndex", () => {
  it("indexes aircraft by base airport and flight endpoints", () => {
    __resetWorldFleetIndexCacheForTests();
    const fleetByOwner = new Map<string, AircraftInstance[]>([
      [
        "comp1",
        [
          makeAircraft("a1", "comp1", "JFK"),
          makeAircraft("a2", "comp1", "LAX", { originIata: "LAX", destinationIata: "LHR" }),
        ],
      ],
    ]);

    expect(getWorldFleetAtAirport(fleetByOwner, "player", "JFK").map((a) => a.id)).toEqual(["a1"]);
    // Enroute aircraft are reachable from both flight endpoints.
    expect(getWorldFleetAtAirport(fleetByOwner, "player", "LAX").map((a) => a.id)).toEqual(["a2"]);
    expect(getWorldFleetAtAirport(fleetByOwner, "player", "LHR").map((a) => a.id)).toEqual(["a2"]);
    expect(getWorldFleetAtAirport(fleetByOwner, "player", "MAD")).toEqual([]);
  });

  it("excludes the player owner from the world index", () => {
    __resetWorldFleetIndexCacheForTests();
    const fleetByOwner = new Map<string, AircraftInstance[]>([
      ["player", [makeAircraft("p1", "player", "JFK")]],
      ["comp1", [makeAircraft("c1", "comp1", "JFK")]],
    ]);

    const atJfk = getWorldFleetAtAirport(fleetByOwner, "player", "JFK");
    expect(atJfk.map((a) => a.id)).toEqual(["c1"]);
  });

  it("caches the index per fleetByOwner reference", () => {
    __resetWorldFleetIndexCacheForTests();
    const fleetByOwner = new Map<string, AircraftInstance[]>([
      ["comp1", [makeAircraft("c1", "comp1", "JFK")]],
    ]);

    const first = getWorldFleetByAirport(fleetByOwner, null);
    const second = getWorldFleetByAirport(fleetByOwner, null);
    expect(second).toBe(first);

    // A new world reference (store replaces the Map on every world write)
    // invalidates the cache and rebuilds.
    const rebuilt = new Map<string, AircraftInstance[]>([
      ["comp1", [makeAircraft("c1", "comp1", "JFK"), makeAircraft("c2", "comp1", "EWR")]],
    ]);
    const third = getWorldFleetByAirport(rebuilt, null);
    expect(third).not.toBe(first);
    expect(third.get("EWR")?.map((a) => a.id)).toEqual(["c2"]);
  });
});
