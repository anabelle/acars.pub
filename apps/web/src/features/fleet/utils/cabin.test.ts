import type { TimelineEvent } from "@acars/core";
import { fp } from "@acars/core";
import { describe, expect, it } from "vitest";
import { cabinRows, landingReceipt, passengerVoice } from "./cabin";

describe("cabinRows (S63)", () => {
  it("draws a glyph per seat on small planes, first class first, empty classes left out", () => {
    const { rows, seatsPerGlyph } = cabinRows(
      { economy: 60, business: 8, first: 0 },
      { economy: 52, business: 8, first: 0 },
    );
    expect(seatsPerGlyph).toBe(1);
    expect(rows).toEqual([
      { cls: "business", seats: 8, filled: 8, glyphs: 8, filledGlyphs: 8 },
      { cls: "economy", seats: 60, filled: 52, glyphs: 60, filledGlyphs: 52 },
    ]);
  });

  it("groups seats on big planes and never overfills", () => {
    const { rows, seatsPerGlyph } = cabinRows(
      { economy: 300, business: 40, first: 8 },
      { economy: 999, business: 20, first: 0 },
    );
    expect(seatsPerGlyph).toBe(3);
    expect(rows.map((r) => r.glyphs)).toEqual([3, 14, 100]);
    expect(rows[2]).toMatchObject({ filled: 300, filledGlyphs: 100 });
    expect(rows[0]).toMatchObject({ filled: 0, filledGlyphs: 0 });
  });
});

const landing = (id: string, load = 0.8, pax = { economy: 50, business: 0, first: 0, total: 50 }) =>
  ({
    id,
    tick: 1,
    timestamp: 0,
    type: "landing",
    description: "",
    profit: fp(500),
    details: {
      loadFactor: load,
      passengers: pax,
      revenue: {
        tickets: fp(7_000),
        economy: fp(7_000),
        business: fp(0),
        first: fp(0),
        ancillary: fp(300),
      },
      costs: {
        fuel: fp(2_000),
        crew: fp(1_000),
        maintenance: fp(800),
        airport: fp(600),
        navigation: fp(400),
        leasing: fp(1_000),
        handling: fp(500),
        overhead: fp(500),
      },
    },
  }) as TimelineEvent;

describe("landingReceipt (S63)", () => {
  it("lists income and every recorded cost, and the net", () => {
    const receipt = landingReceipt(landing("x"));
    expect(receipt?.income.map((l) => l.key)).toEqual(["economy", "ancillary"]);
    expect(receipt?.costs.map((l) => l.key)).toEqual([
      "fuel",
      "crew",
      "maintenance",
      "airport",
      "navigation",
      "handling",
      "leasing",
      "overhead",
    ]);
    expect(receipt?.net).toBe(fp(500));
  });

  it("is null for old events without a breakdown", () => {
    expect(landingReceipt({ ...landing("x"), details: {} } as TimelineEvent)).toBeNull();
  });
});

describe("passengerVoice (S63)", () => {
  it("is deterministic, rare, and fits the flight", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `evt-landing-${i}`);
    const voiced = ids.filter((id) => passengerVoice(landing(id)) !== null);
    expect(voiced.length).toBeGreaterThan(8);
    expect(voiced.length).toBeLessThan(35);
    const id = voiced[0];
    expect(passengerVoice(landing(id))).toBe(passengerVoice(landing(id)));
    expect(passengerVoice(landing(id, 0.99))).toBe("full");
    expect(passengerVoice(landing(id, 0.3))).toBe("roomy");
    expect(passengerVoice(landing(id, 0.8))).toBe("smooth");
  });
});
