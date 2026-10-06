import { describe, expect, it } from "vitest";
import { brandServiceGrade } from "./brand.js";

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
