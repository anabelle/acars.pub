import { describe, expect, it } from "vitest";
import type { PlaneSchedule } from "./aircraft";
import type { RouteArc } from "./arcs";
import { airportCardModel, planeCardModel, routeCardModel } from "./cardModels";

const arc = (overrides: Partial<RouteArc> = {}): RouteArc => ({
  id: "r",
  originIata: "MAD",
  destinationIata: "BCN",
  ownerPubkey: "abcdef1234567890",
  frequencyPerWeek: 14,
  distanceKm: 483.4,
  source: [0, 0],
  target: [1, 1],
  path: [],
  color: [0, 0, 0, 0],
  width: 1,
  isPlayer: true,
  ...overrides,
});

describe("routeCardModel()", () => {
  it("names the owner and rounds the distance", () => {
    expect(routeCardModel(arc(), () => "E2E Air")).toEqual({
      originIata: "MAD",
      destinationIata: "BCN",
      ownerName: "E2E Air",
      isPlayer: true,
      frequencyPerWeek: 14,
      distanceKm: 483,
    });
  });

  it("falls back to a short pubkey and a daily schedule", () => {
    const model = routeCardModel(arc({ frequencyPerWeek: undefined }), () => undefined);
    expect(model.ownerName).toBe("abcdef12…");
    expect(model.frequencyPerWeek).toBe(7);
  });
});

describe("airportCardModel()", () => {
  it("counts the routes touching the airport, yours and everyone's", () => {
    const arcs = [
      arc(),
      arc({ originIata: "BCN", destinationIata: "LHR", isPlayer: false }),
      arc({ originIata: "MAD", destinationIata: "LIS", isPlayer: false }),
    ];
    expect(airportCardModel("BCN", arcs)).toEqual({ iata: "BCN", yourRoutes: 1, worldRoutes: 2 });
    expect(airportCardModel("JFK", arcs)).toEqual({ iata: "JFK", yourRoutes: 0, worldRoutes: 0 });
  });
});

describe("planeCardModel()", () => {
  const plane: PlaneSchedule = {
    originIata: "MAD",
    destinationIata: "BCN",
    isPlayer: true,
    source: [0, 0],
    target: [1, 1],
    departureTick: 0,
    // 1,200 ticks = one hour.
    arrivalTick: 1200,
    peakMeters: 1,
    color: [0, 0, 0, 0],
    loop: false,
  };

  it("reports progress and minutes left for a real flight", () => {
    expect(planeCardModel(plane, 300)).toEqual({
      synthetic: false,
      originIata: "MAD",
      destinationIata: "BCN",
      isPlayer: true,
      progressPct: 25,
      minutesLeft: 45,
    });
    expect(planeCardModel(plane, 5000)).toMatchObject({ progressPct: 100, minutesLeft: 0 });
  });

  it("marks load-generator planes as synthetic", () => {
    expect(
      planeCardModel({ ...plane, originIata: undefined, destinationIata: undefined }, 300),
    ).toEqual({ synthetic: true });
  });
});
