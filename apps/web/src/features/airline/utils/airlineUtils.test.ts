import { nip19 } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { airlineNpub, airlinePath, parseAirlineKey } from "./airlineKey";
import { projectRouteMap } from "./routeMap";

const HEX = "a".repeat(63) + "b";

describe("parseAirlineKey()", () => {
  it("accepts npub and hex, rejects anything else", () => {
    const npub = nip19.npubEncode(HEX);
    expect(parseAirlineKey(npub)).toBe(HEX);
    expect(parseAirlineKey(HEX.toUpperCase())).toBe(HEX);
    expect(parseAirlineKey(` ${npub} `)).toBe(HEX);
    expect(parseAirlineKey("npub1notvalid")).toBeNull();
    expect(parseAirlineKey(nip19.noteEncode(HEX))).toBeNull();
    expect(parseAirlineKey("hello")).toBeNull();
    expect(parseAirlineKey("")).toBeNull();
    expect(parseAirlineKey(undefined)).toBeNull();
  });

  it("builds the shareable path", () => {
    expect(airlinePath(HEX)).toBe(`/airline/${nip19.npubEncode(HEX)}`);
    expect(airlineNpub("not-hex")).toBe("not-hex");
  });
});

describe("projectRouteMap()", () => {
  const airports = {
    MAD: { iata: "MAD", latitude: 40.47, longitude: -3.56 },
    BCN: { iata: "BCN", latitude: 41.3, longitude: 2.08 },
    LIS: { iata: "LIS", latitude: 38.77, longitude: -9.13 },
  } as const;
  const lookup = (iata: string) => airports[iata as keyof typeof airports];
  const box = { width: 400, height: 200, padding: 20 };

  it("fits every airport inside the padded box, to scale", () => {
    const map = projectRouteMap(
      [
        { originIata: "MAD", destinationIata: "BCN" },
        { originIata: "MAD", destinationIata: "LIS" },
      ],
      lookup,
      { ...box, hubs: ["MAD"] },
    );
    expect(map.points.map((p) => p.iata)).toEqual(["BCN", "LIS", "MAD"]);
    for (const p of map.points) {
      expect(p.x).toBeGreaterThanOrEqual(20);
      expect(p.x).toBeLessThanOrEqual(380);
      expect(p.y).toBeGreaterThanOrEqual(20);
      expect(p.y).toBeLessThanOrEqual(180);
    }
    const byIata = Object.fromEntries(map.points.map((p) => [p.iata, p]));
    expect(byIata.LIS.x).toBeLessThan(byIata.MAD.x); // west is left
    expect(byIata.BCN.y).toBeLessThan(byIata.MAD.y); // north is up
    expect(byIata.MAD.hub).toBe(true);
    expect(map.lines).toHaveLength(2);
  });

  it("skips unknown airports, shows hubs alone, and handles an empty network", () => {
    const map = projectRouteMap([{ originIata: "MAD", destinationIata: "ZZZ" }], lookup, {
      ...box,
      hubs: ["MAD", "QQQ"],
    });
    expect(map.lines).toHaveLength(0);
    expect(map.points).toEqual([{ iata: "MAD", x: 200, y: 100, hub: true }]);
    expect(projectRouteMap([], lookup, box)).toEqual({
      width: 400,
      height: 200,
      points: [],
      lines: [],
    });
  });
});
