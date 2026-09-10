// ============================================================
// @acars/core — QSI Tests
// ============================================================

import { describe, it, expect } from "vitest";
import { calculateShares, allocatePassengers } from "./qsi.js";
import { fp } from "./fixed-point.js";
import type { FlightOffer, DemandResult } from "./types.js";

describe("calculateShares()", () => {
  it("gives 100% to a monopoly", () => {
    const offers: FlightOffer[] = [
      {
        airlinePubkey: "monopoly",
        fareEconomy: fp(500),
        fareBusiness: fp(1500),
        fareFirst: fp(3000),
        frequencyPerWeek: 14,
        travelTimeMinutes: 300,
        stops: 0,
        serviceScore: 0.8,
        brandScore: 0.8,
      },
    ];

    const shares = calculateShares(offers);
    expect(shares.economy.get("monopoly")).toBe(1.0);
    expect(shares.business.get("monopoly")).toBe(1.0);
    expect(shares.first.get("monopoly")).toBe(1.0);
  });

  it("splits evenly between identical offers", () => {
    const base = {
      fareEconomy: fp(500),
      fareBusiness: fp(1500),
      fareFirst: fp(3000),
      frequencyPerWeek: 14,
      travelTimeMinutes: 300,
      stops: 0,
      serviceScore: 0.8,
      brandScore: 0.8,
    };

    const offers: FlightOffer[] = [
      { ...base, airlinePubkey: "airlineA" },
      { ...base, airlinePubkey: "airlineB" },
    ];

    const shares = calculateShares(offers);
    expect(shares.economy.get("airlineA")).toBeCloseTo(0.5);
    expect(shares.economy.get("airlineB")).toBeCloseTo(0.5);
  });

  it("favors cheaper flights heavily in economy, but less in business/first", () => {
    const offers: FlightOffer[] = [
      {
        airlinePubkey: "cheap",
        fareEconomy: fp(300),
        fareBusiness: fp(1000),
        fareFirst: fp(2000),
        frequencyPerWeek: 14,
        travelTimeMinutes: 300,
        stops: 0,
        serviceScore: 0.5,
        brandScore: 0.5,
      },
      {
        airlinePubkey: "expensive",
        fareEconomy: fp(600),
        fareBusiness: fp(2000),
        fareFirst: fp(4000),
        frequencyPerWeek: 14,
        travelTimeMinutes: 300,
        stops: 0,
        serviceScore: 0.5,
        brandScore: 0.5,
      },
    ];

    const shares = calculateShares(offers);

    const cheapEco = shares.economy.get("cheap")!;
    const expEco = shares.economy.get("expensive")!;
    expect(cheapEco).toBeGreaterThan(expEco);

    const cheapBiz = shares.business.get("cheap")!;
    const expBiz = shares.business.get("expensive")!;
    // The *ratio* of advantage should be smaller in business than in economy
    expect(cheapEco / expEco).toBeGreaterThan(cheapBiz / expBiz);
  });
});

describe("allocatePassengers()", () => {
  it("returns empty exact values when there is no demand", () => {
    const offers: FlightOffer[] = [
      {
        airlinePubkey: "A",
        fareEconomy: fp(100),
        fareBusiness: fp(200),
        fareFirst: fp(300),
        frequencyPerWeek: 7,
        travelTimeMinutes: 100,
        stops: 0,
        serviceScore: 0.5,
        brandScore: 0.5,
      },
    ];

    const demand: DemandResult = {
      origin: "JFK",
      destination: "LAX",
      economy: 0,
      business: 0,
      first: 0,
    };
    const alloc = allocatePassengers(offers, demand);

    expect(alloc.get("A")).toEqual({ economy: 0, business: 0, first: 0 });
  });

  it("allocates without losing any passengers (Largest Remainder Method)", () => {
    const base = {
      fareEconomy: fp(500),
      fareBusiness: fp(1500),
      fareFirst: fp(3000),
      frequencyPerWeek: 14,
      travelTimeMinutes: 300,
      stops: 0,
      serviceScore: 0.8,
      brandScore: 0.8,
    };

    const offers: FlightOffer[] = [
      { ...base, airlinePubkey: "airlineA" },
      { ...base, airlinePubkey: "airlineB" },
      { ...base, airlinePubkey: "airlineC" },
    ];

    // 100 passengers split by 3 is 33.33 each
    const demand: DemandResult = {
      origin: "JFK",
      destination: "LAX",
      economy: 100,
      business: 10,
      first: 0,
    };
    const alloc = allocatePassengers(offers, demand);

    const a = alloc.get("airlineA")!;
    const b = alloc.get("airlineB")!;
    const c = alloc.get("airlineC")!;

    // Total should be exactly 100
    expect(a.economy + b.economy + c.economy).toBe(100);

    // Exact integer counts
    expect([a.economy, b.economy, c.economy].sort()).toEqual([33, 33, 34]);

    expect(a.business + b.business + c.business).toBe(10);
    expect(a.first + b.first + c.first).toBe(0);
  });

  it("deterministically breaks exact ties using pubkey", () => {
    const base = {
      fareEconomy: fp(500),
      fareBusiness: fp(1500),
      fareFirst: fp(3000),
      frequencyPerWeek: 14,
      travelTimeMinutes: 300,
      stops: 0,
      serviceScore: 0.8,
      brandScore: 0.8,
    };

    const offers: FlightOffer[] = [
      { ...base, airlinePubkey: "airlineA" },
      { ...base, airlinePubkey: "airlineB" },
    ];

    const demand: DemandResult = {
      origin: "JFK",
      destination: "LAX",
      economy: 3,
      business: 0,
      first: 0,
    };

    // Both have exact 1.5 seats. b.remainder - a.remainder is 0, so the
    // canonical code-unit tie-break fires: compareStrings puts 'airlineA'
    // before 'airlineB' (same order localeCompare gave for these ASCII keys).
    const alloc = allocatePassengers(offers, demand);

    expect(alloc.get("airlineA")!.economy).toBe(2);
    expect(alloc.get("airlineB")!.economy).toBe(1);
  });

  it("handles empty offers (returns empty allocation map)", () => {
    const shares = calculateShares([]);
    expect(shares.economy.size).toBe(0);
    expect(shares.business.size).toBe(0);
    expect(shares.first.size).toBe(0);

    const alloc = allocatePassengers([], {
      origin: "JFK",
      destination: "LAX",
      economy: 100,
      business: 50,
      first: 10,
    });
    expect(alloc.size).toBe(0);
  });

  it("exercises the remainder-descending sort path with unequal remainders", () => {
    // Three airlines with clearly unequal QSI shares → unequal remainders →
    // the `b.remainder - a.remainder` branch of the sort comparator fires.
    const offers: FlightOffer[] = [
      {
        airlinePubkey: "alpha",
        fareEconomy: fp(100),
        fareBusiness: fp(300),
        fareFirst: fp(500),
        frequencyPerWeek: 21,
        travelTimeMinutes: 100,
        stops: 0,
        serviceScore: 0.9,
        brandScore: 0.9,
      },
      {
        airlinePubkey: "bravo",
        fareEconomy: fp(400),
        fareBusiness: fp(800),
        fareFirst: fp(1200),
        frequencyPerWeek: 7,
        travelTimeMinutes: 400,
        stops: 1,
        serviceScore: 0.5,
        brandScore: 0.4,
      },
      {
        airlinePubkey: "charlie",
        fareEconomy: fp(250),
        fareBusiness: fp(600),
        fareFirst: fp(900),
        frequencyPerWeek: 14,
        travelTimeMinutes: 250,
        stops: 0,
        serviceScore: 0.6,
        brandScore: 0.5,
      },
    ];
    const demand: DemandResult = {
      origin: "JFK",
      destination: "LAX",
      economy: 10,
      business: 5,
      first: 2,
    };
    const alloc = allocatePassengers(offers, demand);
    const total = [...alloc.values()].reduce((acc, v) => acc + v.economy + v.business + v.first, 0);
    expect(total).toBe(17);
    // Highest-QSI carrier (alpha) should get the most seats.
    const alpha = alloc.get("alpha")!;
    const bravo = alloc.get("bravo")!;
    expect(alpha.economy + alpha.business + alpha.first).toBeGreaterThan(
      bravo.economy + bravo.business + bravo.first,
    );
  });

  it("handles offers with zero total frequency and multi-stop itineraries", () => {
    // All-zero frequency triggers the totalFrequency===0 guard (→ 1).
    // stops >= 2 triggers the 0.2 stops-score branch.
    const offers: FlightOffer[] = [
      {
        airlinePubkey: "zerofreq",
        fareEconomy: fp(100),
        fareBusiness: fp(300),
        fareFirst: fp(500),
        frequencyPerWeek: 0,
        travelTimeMinutes: 200,
        stops: 2,
        serviceScore: 0.7,
        brandScore: 0.6,
      },
      {
        airlinePubkey: "alsounused",
        fareEconomy: fp(120),
        fareBusiness: fp(320),
        fareFirst: fp(520),
        frequencyPerWeek: 0,
        travelTimeMinutes: 220,
        stops: 3,
        serviceScore: 0.6,
        brandScore: 0.5,
      },
    ];
    const shares = calculateShares(offers);
    // Both get a defined share (no NaN from divide-by-zero).
    expect(shares.economy.get("zerofreq")).toBeTypeOf("number");
    expect(Number.isFinite(shares.economy.get("zerofreq")!)).toBe(true);
    expect(shares.economy.get("alsounused")).toBeTypeOf("number");
    // Shares sum to ~1.0
    const total = shares.economy.get("zerofreq")! + shares.economy.get("alsounused")!;
    expect(total).toBeCloseTo(1.0, 6);
  });

  it("aggregates multiple offers from the same airline pubkey (no passenger evaporation)", () => {
    // "dual" fields two offers on the same market (e.g. JFK→MAD and
    // MAD→JFK); its QSI must be summed into one map entry so Σshares = 1.
    const base = {
      fareEconomy: fp(500),
      fareBusiness: fp(1500),
      fareFirst: fp(3000),
      frequencyPerWeek: 14,
      travelTimeMinutes: 300,
      stops: 0,
      serviceScore: 0.8,
      brandScore: 0.8,
    };

    const offers: FlightOffer[] = [
      { ...base, airlinePubkey: "dual", travelTimeMinutes: 280 },
      { ...base, airlinePubkey: "dual", travelTimeMinutes: 320 },
      { ...base, airlinePubkey: "single" },
    ];

    const shares = calculateShares(offers);

    // Exactly one entry per pubkey.
    expect(shares.economy.size).toBe(2);
    expect(shares.business.size).toBe(2);
    expect(shares.first.size).toBe(2);

    const dualE = shares.economy.get("dual")!;
    const singleE = shares.economy.get("single")!;
    expect(dualE + singleE).toBeCloseTo(1.0, 12);
    // The aggregated dual-offer carrier beats the identical single offer.
    expect(dualE).toBeGreaterThan(singleE);

    const demand: DemandResult = {
      origin: "JFK",
      destination: "MAD",
      economy: 1000,
      business: 100,
      first: 10,
    };
    const alloc = allocatePassengers(offers, demand);
    const totals = [...alloc.values()].reduce(
      (acc, v) => ({
        economy: acc.economy + v.economy,
        business: acc.business + v.business,
        first: acc.first + v.first,
      }),
      { economy: 0, business: 0, first: 0 },
    );
    // No passengers evaporate: exact conservation.
    expect(totals.economy).toBe(1000);
    expect(totals.business).toBe(100);
    expect(totals.first).toBe(10);
    expect(alloc.get("dual")!.economy).toBeGreaterThan(alloc.get("single")!.economy);
  });
});
