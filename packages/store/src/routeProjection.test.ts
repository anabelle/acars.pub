import type { AircraftInstance, FlightOffer, Route } from "@acars/core";
import { fp, fpToNumber, getSuggestedFares } from "@acars/core";
import { getAircraftById, setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { beforeAll, describe, expect, it } from "vitest";
import { processFlightEngine } from "./FlightEngine.js";
import { projectRouteEconomics } from "./routeProjection.js";

const PLAYER = "player-pubkey";

beforeAll(() => {
  setAirportsCatalog(airports);
});

function makeAircraft(modelId: string, routeId: string, base: string): AircraftInstance {
  const model = getAircraftById(modelId);
  if (!model) throw new Error(`unknown model ${modelId}`);
  return {
    id: "ac-1",
    ownerPubkey: PLAYER,
    modelId,
    name: model.name,
    status: "idle",
    assignedRouteId: routeId,
    baseAirportIata: base,
    purchasedAtTick: 0,
    purchasePrice: fp(1_000_000),
    birthTick: 0,
    listingPrice: null,
    flight: null,
    purchaseType: "buy",
    configuration: {
      economy: model.capacity.economy,
      business: model.capacity.business,
      first: model.capacity.first,
      cargoKg: model.capacity.cargoKg,
    },
    flightHoursTotal: 0,
    flightHoursSinceCheck: 0,
    condition: 1,
  };
}

/** Runs one real outbound landing through the engine, like FlightEngine.test's helper. */
function landOnce(
  modelId: string,
  origin: string,
  destination: string,
  distanceKm: number,
  fareMultiplier: number,
  aircraftCount: number,
  registry: Map<string, FlightOffer[]> = new Map(),
) {
  const suggested = getSuggestedFares(distanceKm);
  const route: Route = {
    id: "route-1",
    originIata: origin,
    destinationIata: destination,
    airlinePubkey: PLAYER,
    distanceKm,
    frequencyPerWeek: 7,
    assignedAircraftIds: Array.from({ length: aircraftCount }, (_, i) =>
      i === 0 ? "ac-1" : `o-${i}`,
    ),
    fareEconomy: fp(fpToNumber(suggested.economy) * fareMultiplier),
    fareBusiness: fp(fpToNumber(suggested.business) * fareMultiplier),
    fareFirst: fp(fpToNumber(suggested.first) * fareMultiplier),
    status: "active",
  };
  const aircraft = makeAircraft(modelId, route.id, origin);
  const run = (tick: number, fleet: AircraftInstance[], lastTick: number) =>
    processFlightEngine(tick, fleet, [route], fp(1_000_000), lastTick, registry, PLAYER, 0.5);

  const takeoff = run(1, [aircraft], 0);
  const arrivalTick = takeoff.updatedFleet[0].flight?.arrivalTick;
  if (!arrivalTick) throw new Error("expected an enroute flight");
  const landed = run(arrivalTick, takeoff.updatedFleet, 1);
  const landing = landed.events.find((event) => event.type === "landing");
  if (!landing) throw new Error("expected a landing");
  return { route, landing, arrivalTick };
}

describe("projectRouteEconomics", () => {
  const cases: Array<[string, string, string, number, number, number]> = [
    ["atr72-600", "MAD", "BCN", 483, 1, 1],
    ["atr72-600", "MAD", "BCN", 483, 40, 1],
    ["atr72-600", "DEN", "SLC", 628, 1, 1],
    ["atr72-600", "DEN", "SLC", 628, 5, 1],
    ["atr72-600", "DEN", "SLC", 628, 1, 3],
    ["a320neo", "JFK", "LAX", 3000, 1.3, 1],
  ];

  for (const [modelId, origin, destination, km, multiplier, count] of cases) {
    it(`matches a real engine landing: ${modelId} ${origin}-${destination} ×${multiplier} (${count} aircraft)`, () => {
      const { route, landing, arrivalTick } = landOnce(
        modelId,
        origin,
        destination,
        km,
        multiplier,
        count,
      );
      const model = getAircraftById(modelId);
      if (!model) throw new Error("model");

      const projection = projectRouteEconomics({
        originIata: origin,
        destinationIata: destination,
        distanceKm: km,
        model,
        aircraftCount: count,
        fares: { economy: route.fareEconomy, business: route.fareBusiness, first: route.fareFirst },
        tick: arrivalTick,
        playerPubkey: PLAYER,
        networkRoutes: [route],
      });

      expect(projection.outbound.passengers.total).toBe(landing.details?.passengers?.total);
      expect(projection.outbound.revenue).toBe(landing.revenue);
      expect(projection.outbound.cost).toBe(landing.cost);
      expect(projection.outbound.profit).toBe(landing.profit);
    });
  }

  it("reports daily figures and market share", () => {
    const model = getAircraftById("atr72-600");
    if (!model) throw new Error("model");
    const rival: FlightOffer = {
      airlinePubkey: "rival",
      fareEconomy: fp(120),
      fareBusiness: fp(300),
      fareFirst: fp(700),
      frequencyPerWeek: 30,
      travelTimeMinutes: 60,
      stops: 0,
      serviceScore: 0.7,
      brandScore: 0.6,
    };
    const projection = projectRouteEconomics({
      originIata: "MAD",
      destinationIata: "BCN",
      distanceKm: 483,
      model,
      tick: 1000,
      competitorOffers: [rival],
    });

    expect(projection.flightsPerDay).toBeCloseTo((projection.frequencyPerWeek * 2) / 7, 10);
    expect(fpToNumber(projection.profitPerDay)).toBeCloseTo(
      fpToNumber(projection.profitPerFlight) * projection.flightsPerDay,
      0,
    );
    expect(projection.marketShare).toBeGreaterThan(0);
    expect(projection.marketShare).toBeLessThan(1);
    expect(projection.competitorShares).toEqual([
      { airlinePubkey: "rival", share: expect.any(Number) },
    ]);
    expect(projection.marketShare + projection.competitorShares[0].share).toBeCloseTo(1, 6);
  });

  it("flies the scheduled frequency, capped by what the aircraft can do (S14)", () => {
    const model = getAircraftById("atr72-600");
    if (!model) throw new Error("model");
    const base = { originIata: "MAD", destinationIata: "BCN", distanceKm: 483, model, tick: 1000 };

    // A new route (7 round trips a week) flies two legs a day.
    const weekly = projectRouteEconomics(base);
    expect(weekly.frequencyPerWeek).toBe(7);
    expect(weekly.flightsPerDay).toBeCloseTo(2, 10);

    // Asking for more than one ATR can fly is capped at its physical maximum.
    const greedy = projectRouteEconomics({ ...base, frequencyPerWeek: 10_000 });
    expect(greedy.frequencyPerWeek).toBeLessThan(10_000);
    expect(greedy.flightsPerDay).toBeGreaterThan(14);
    expect(greedy.flightsPerDay).toBeLessThan(20);
  });
});
