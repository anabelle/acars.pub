import type { AircraftInstance } from "@acars/core";
import { describe, expect, it } from "vitest";
import {
  allocatePlaneBuffers,
  legProgress,
  type PlaneSchedule,
  planesFromFleet,
  syntheticPlanes,
  writePlanePositions,
} from "./aircraft";

const AIRPORTS: Record<string, { latitude: number; longitude: number }> = {
  MAD: { latitude: 40.47, longitude: -3.56 },
  BCN: { latitude: 41.3, longitude: 2.08 },
  JFK: { latitude: 40.64, longitude: -73.78 },
};
const lookup = (iata: string) => AIRPORTS[iata];

const aircraft = (overrides: Partial<AircraftInstance>): AircraftInstance =>
  ({
    id: "a1",
    status: "enroute",
    flight: {
      originIata: "MAD",
      destinationIata: "BCN",
      departureTick: 100,
      arrivalTick: 200,
      direction: "outbound",
    },
    ...overrides,
  }) as AircraftInstance;

const leg = (overrides: Partial<PlaneSchedule> = {}): PlaneSchedule => ({
  isPlayer: true,
  source: [-3.56, 40.47],
  target: [2.08, 41.3],
  departureTick: 100,
  arrivalTick: 200,
  peakMeters: 40_000,
  color: [255, 0, 0, 255],
  loop: false,
  ...overrides,
});

describe("planesFromFleet()", () => {
  it("keeps only aircraft in the air with known airports", () => {
    const planes = planesFromFleet(
      [
        {
          fleet: [
            aircraft({}),
            aircraft({ id: "parked", status: "idle", flight: null }),
            aircraft({
              id: "unknown",
              flight: {
                originIata: "MAD",
                destinationIata: "ZZZ",
                departureTick: 0,
                arrivalTick: 1,
                direction: "outbound",
              },
            }),
          ],
          colorHex: "#ff0000",
          isPlayer: true,
        },
      ],
      lookup,
    );
    expect(planes).toHaveLength(1);
    expect(planes[0]).toMatchObject({
      originIata: "MAD",
      destinationIata: "BCN",
      isPlayer: true,
      source: [-3.56, 40.47],
      target: [2.08, 41.3],
      departureTick: 100,
      arrivalTick: 200,
      color: [255, 0, 0, 255],
      loop: false,
    });
    expect(planes[0].peakMeters).toBeGreaterThan(30_000);
  });

  it("dims rivals", () => {
    const [rival] = planesFromFleet(
      [{ fleet: [aircraft({})], colorHex: "#ff0000", isPlayer: false }],
      lookup,
    );
    expect(rival.color[3]).toBeLessThan(255);
  });
});

describe("syntheticPlanes()", () => {
  const pool = Object.values(AIRPORTS);

  it("makes exactly the requested load, deterministically, mid-flight", () => {
    const a = syntheticPlanes(500, pool, 10_000);
    const b = syntheticPlanes(500, pool, 10_000);
    expect(a).toHaveLength(500);
    expect(a).toEqual(b);
    for (const plane of a) {
      expect(plane.loop).toBe(true);
      expect(plane.departureTick).toBeLessThanOrEqual(10_000);
      expect(plane.arrivalTick).toBeGreaterThan(10_000);
    }
  });

  it("returns nothing without a usable pool", () => {
    expect(syntheticPlanes(10, [pool[0]], 0)).toEqual([]);
    expect(syntheticPlanes(0, pool, 0)).toEqual([]);
    // One airport twice: no leg is long enough, so it gives up.
    expect(syntheticPlanes(10, [pool[0], pool[0]], 0)).toEqual([]);
  });
});

describe("legProgress()", () => {
  it("runs 0 to 1 over the leg and clamps outside it", () => {
    expect(legProgress(leg(), 150)).toBe(0.5);
    expect(legProgress(leg(), 50)).toBe(0);
    expect(legProgress(leg(), 250)).toBe(1);
    expect(legProgress(leg({ arrivalTick: 100 }), 150)).toBe(1);
  });

  it("wraps looping legs", () => {
    expect(legProgress(leg({ loop: true }), 250)).toBe(0.5);
  });
});

describe("writePlanePositions()", () => {
  it("puts each plane on its arc, highest mid-leg", () => {
    const planes = [leg(), leg({ departureTick: 0, arrivalTick: 400 })];
    const buffers = allocatePlaneBuffers(planes);
    expect(buffers.colors.slice(0, 4)).toEqual(new Uint8Array([255, 0, 0, 255]));
    writePlanePositions(planes, 150, buffers);
    // Halfway MAD → BCN: between the two, at the arc's peak.
    expect(buffers.positions[0]).toBeGreaterThan(-3.56);
    expect(buffers.positions[0]).toBeLessThan(2.08);
    expect(buffers.positions[2]).toBeCloseTo(40_000);
    // The second plane is less far along, so lower.
    expect(buffers.positions[5]).toBeLessThan(buffers.positions[2]);

    // On the ground at arrival.
    writePlanePositions(planes, 200, buffers);
    expect(buffers.positions[0]).toBeCloseTo(2.08);
    expect(buffers.positions[2]).toBeCloseTo(0);
  });
});
