import { describe, expect, it } from "vitest";
import { BRAND_LANDING_WEIGHT, brandServiceGrade, brandTarget, nextBrandScore } from "./brand.js";

const good = { loadFactor: 0.8, fareRatio: 1, condition: 0.95 };

describe("brandServiceGrade()", () => {
  it("rewards fair fares, sound aircraft and a healthy load factor", () => {
    expect(brandServiceGrade(good)).toBe(1);
    expect(brandServiceGrade({ ...good, fareRatio: 1.2 })).toBe(1);
    expect(brandServiceGrade({ ...good, loadFactor: 0.6 })).toBe(1);
  });

  it("does not reward full planes bought with gouging fares", () => {
    expect(brandServiceGrade({ ...good, loadFactor: 0.88, fareRatio: 1.35 })).toBeCloseTo(-0.5, 10);
    expect(brandServiceGrade({ ...good, loadFactor: 0.88, fareRatio: 2 })).toBe(-1);
  });

  it("penalises worn aircraft", () => {
    expect(brandServiceGrade({ ...good, condition: 0.45 })).toBeCloseTo(-0.5, 10);
    expect(brandServiceGrade({ ...good, condition: 0 })).toBe(-1);
  });

  it("penalises empty flights from over-assignment", () => {
    expect(brandServiceGrade({ ...good, loadFactor: 0.35 })).toBeCloseTo(-0.5, 10);
    expect(brandServiceGrade({ ...good, loadFactor: 0.1 })).toBe(-1);
  });

  it("is neutral outside the healthy band without penalties", () => {
    expect(brandServiceGrade({ ...good, loadFactor: 0.55 })).toBe(0);
    expect(brandServiceGrade({ ...good, loadFactor: 0.95 })).toBe(0);
  });

  it("adds penalties together, capped at -1", () => {
    expect(brandServiceGrade({ loadFactor: 0.425, fareRatio: 1.275, condition: 0.95 })).toBeCloseTo(
      -0.5,
      10,
    );
    expect(brandServiceGrade({ loadFactor: 0, fareRatio: 3, condition: 0 })).toBe(-1);
  });
});

describe("brandTarget()", () => {
  it("maps grades onto [0.1, 0.9]", () => {
    expect(brandTarget(-1)).toBeCloseTo(0.1, 10);
    expect(brandTarget(0)).toBe(0.5);
    expect(brandTarget(1)).toBeCloseTo(0.9, 10);
    expect(brandTarget(5)).toBeCloseTo(0.9, 10);
  });
});

describe("nextBrandScore()", () => {
  it("does nothing without landings", () => {
    expect(nextBrandScore(0.42, 1, 0)).toBe(0.42);
  });

  it("closes a share of the gap per landing", () => {
    expect(nextBrandScore(0.5, 1, 1)).toBeCloseTo(0.5 + 0.4 * BRAND_LANDING_WEIGHT, 12);
  });

  it("matches landing one at a time", () => {
    let stepwise = 0.5;
    for (let i = 0; i < 50; i += 1) stepwise = nextBrandScore(stepwise, -0.5, 1);
    expect(nextBrandScore(0.5, -0.5, 50)).toBeCloseTo(stepwise, 10);
  });

  it("good service climbs, gouging falls, both bounded", () => {
    expect(nextBrandScore(0.5, 1, 600)).toBeGreaterThan(0.7);
    expect(nextBrandScore(0.5, -1, 600)).toBeLessThan(0.3);
    expect(nextBrandScore(0.5, 1, 1e6)).toBeLessThanOrEqual(0.9 + 1e-9);
    expect(nextBrandScore(0.5, -1, 1e6)).toBeGreaterThanOrEqual(0.1);
    expect(nextBrandScore(1.4, 1, 1)).toBeLessThanOrEqual(1);
  });
});
