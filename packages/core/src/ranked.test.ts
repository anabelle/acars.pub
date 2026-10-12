import { describe, expect, it } from "vitest";
import { getSuggestedFares } from "./finance.js";
import { fp } from "./fixed-point.js";
import { isRankedId, powBits, RANKED_POW_BITS, unrankedOffer } from "./ranked.js";
import type { FlightOffer } from "./types.js";

const id = (prefix: string) => prefix + "f".repeat(64 - prefix.length);

describe("proof of work (S72)", () => {
  it("counts leading zero bits like NIP-13", () => {
    expect(powBits(id("f"))).toBe(0);
    expect(powBits(id("7"))).toBe(1);
    expect(powBits(id("1"))).toBe(3);
    expect(powBits(id("0"))).toBe(4);
    expect(powBits(id("00003"))).toBe(18);
    expect(powBits(id("00001"))).toBe(19);
    expect(powBits("0".repeat(64))).toBe(256);
    expect(powBits("x00")).toBe(0);
    expect(powBits("00x")).toBe(8);
  });

  it("ranks ids with enough work, and only real ids", () => {
    expect(RANKED_POW_BITS).toBe(18);
    expect(isRankedId(id("00003"))).toBe(true);
    expect(isRankedId(id("00004"))).toBe(false);
    expect(isRankedId("00000")).toBe(false);
    expect(isRankedId(id("00004"), 16)).toBe(true);
  });
});

describe("unrankedOffer (S72)", () => {
  const suggested = getSuggestedFares(500);
  const offer: FlightOffer = {
    airlinePubkey: "throwaway",
    fareEconomy: fp(1),
    fareBusiness: fp(1),
    fareFirst: (suggested.first + fp(50)) as never,
    frequencyPerWeek: 70,
    travelTimeMinutes: 60,
    stops: 0,
    serviceScore: 0.7,
    brandScore: 0.5,
  };

  it("can't undercut the suggested fare, but may charge more", () => {
    const seen = unrankedOffer(offer, 500);
    expect(seen.fareEconomy).toBe(suggested.economy);
    expect(seen.fareBusiness).toBe(suggested.business);
    expect(seen.fareFirst).toBe(offer.fareFirst);
    expect(seen.frequencyPerWeek).toBe(70);
  });

  it("floors announced fares too", () => {
    const seen = unrankedOffer({ ...offer, next: { effectiveTick: 9, fareEconomy: fp(2) } }, 500);
    expect(seen.next).toEqual({ effectiveTick: 9, fareEconomy: suggested.economy });
    const all = unrankedOffer(
      { ...offer, next: { effectiveTick: 9, fareBusiness: fp(2), fareFirst: fp(3) } },
      500,
    );
    expect(all.next).toEqual({
      effectiveTick: 9,
      fareBusiness: suggested.business,
      fareFirst: suggested.first,
    });
  });
});
