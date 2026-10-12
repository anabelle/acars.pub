import type { AircraftInstance, TimelineEvent } from "@acars/core";
import { TICKS_PER_HOUR } from "@acars/core";
import { describe, expect, it } from "vitest";
import { buildAcarsFeed, cruiseLevel, taxiTicks } from "./acars";

const H = TICKS_PER_HOUR;
const coords: Record<string, { latitude: number; longitude: number }> = {
  MAD: { latitude: 40.47, longitude: -3.56 },
  JFK: { latitude: 40.64, longitude: -73.78 },
  BCN: { latitude: 41.3, longitude: 2.08 },
};
const plane = (over: Partial<AircraftInstance> = {}) =>
  ({
    id: "a1",
    name: "Quetzal",
    status: "idle",
    assignedRouteId: "r1",
    ...over,
  }) as AircraftInstance;
const landing = (tick: number, duration: number): TimelineEvent => ({
  id: `l-${tick}`,
  tick,
  timestamp: 0,
  type: "landing",
  description: "",
  aircraftId: "a1",
  originIata: "MAD",
  destinationIata: "BCN",
  details: {
    flightDurationTicks: duration,
    loadFactor: 0.875,
    passengers: { economy: 140, business: 0, first: 0, total: 140 },
  },
});
const base = {
  airport: (iata: string) => coords[iata],
  flightLabel: () => "EEA 2134",
};

describe("taxiTicks", () => {
  it("is deterministic and capped by the block time", () => {
    expect(taxiTicks("x", 10 * H)).toEqual(taxiTicks("x", 10 * H));
    const t = taxiTicks("x", 10 * H);
    expect(t.out).toBeGreaterThanOrEqual(8 * (H / 60));
    expect(t.out).toBeLessThanOrEqual(17 * (H / 60));
    expect(taxiTicks("x", 30).out).toBeLessThanOrEqual(5);
  });
});

describe("cruiseLevel", () => {
  it("climbs with stage length", () => {
    expect(cruiseLevel(300)).toBe("FL240");
    expect(cruiseLevel(500)).toBe("FL340");
    expect(cruiseLevel(5800)).toBe("FL380");
  });
});

describe("buildAcarsFeed", () => {
  it("turns a landing into OUT, OFF, ON and IN, newest first", () => {
    const feed = buildAcarsFeed({
      ...base,
      timeline: [landing(100 * H, H + H / 2)],
      fleet: [plane()],
      tick: 101 * H,
    });
    expect(feed.map((m) => m.kind)).toEqual(["IN", "ON", "OFF", "OUT"]);
    expect(feed[0].body).toBe("BCN PAX 140 LF 88%");
    expect(feed[3].body).toMatch(/^MAD-BCN ETA \d\d:\d\dZ$/);
    expect(feed[0].flight).toBe("EEA 2134");
  });

  it("reports position each whole hour while a long flight cruises, and nothing in the future", () => {
    const departure = 200 * H + 10;
    const feed = buildAcarsFeed({
      ...base,
      timeline: [],
      fleet: [
        plane({
          status: "enroute",
          flight: {
            originIata: "MAD",
            destinationIata: "JFK",
            departureTick: departure,
            arrivalTick: departure + 8 * H,
            direction: "outbound",
          },
        }),
      ],
      tick: departure + 4 * H,
    });
    const kinds = feed.map((m) => m.kind);
    expect(kinds).not.toContain("ON");
    expect(kinds[kinds.length - 1]).toBe("OUT");
    const pos = feed.filter((m) => m.kind === "POS");
    expect(pos.length).toBe(3);
    for (const m of pos) {
      expect(m.tick % H).toBe(0);
      expect(m.tick).toBeLessThanOrEqual(departure + 4 * H);
      expect(m.body).toMatch(/^\d\d\.\d\dN 0\d\d\.\d\dW FL380 GS\d+$/);
    }
  });

  it("filters by plane, window and limit", () => {
    const input = {
      ...base,
      timeline: [
        landing(10 * H, H),
        landing(40 * H, H),
        { ...landing(41 * H, H), aircraftId: "b2" },
      ],
      fleet: [plane(), plane({ id: "b2" })],
      tick: 41 * H,
    };
    expect(buildAcarsFeed(input).every((m) => m.tick >= 17 * H)).toBe(true);
    expect(
      new Set(buildAcarsFeed({ ...input, aircraftId: "a1" }).map((m) => m.aircraftId)),
    ).toEqual(new Set(["a1"]));
    expect(buildAcarsFeed({ ...input, limit: 3 })).toHaveLength(3);
  });

  it("marks a late departure in the OUT message", () => {
    const late = landing(100 * H, H);
    late.details = { ...late.details, delayTicks: 25 * (H / 60) };
    const out = buildAcarsFeed({ ...base, timeline: [late], fleet: [plane()], tick: 101 * H }).find(
      (m) => m.kind === "OUT",
    );
    expect(out?.body).toMatch(/ DLY 0:25$/);
  });
});
