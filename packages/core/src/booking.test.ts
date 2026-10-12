import { describe, expect, it } from "vitest";
import {
  BOOKING_WINDOW_TICKS,
  bookedShare,
  CLASS_LATE_SHARE,
  classBookedShare,
  LATE_BOOKING_SHARE,
} from "./booking.js";
import { TICKS_PER_HOUR } from "./types.js";

describe("booking curve (S70)", () => {
  it("is full at departure and after", () => {
    expect(bookedShare(0)).toBe(1);
    expect(bookedShare(-50)).toBe(1);
    expect(bookedShare(Number.NaN)).toBe(1);
  });

  it("holds the early half a day out or more", () => {
    expect(bookedShare(BOOKING_WINDOW_TICKS)).toBeCloseTo(1 - LATE_BOOKING_SHARE);
    expect(bookedShare(10 * BOOKING_WINDOW_TICKS)).toBeCloseTo(1 - LATE_BOOKING_SHARE);
  });

  it("climbs as departure nears", () => {
    const hours = [12, 6, 2, 1, 0.25].map((h) => bookedShare(h * TICKS_PER_HOUR));
    for (let i = 1; i < hours.length; i++) expect(hours[i]).toBeGreaterThan(hours[i - 1]);
    expect(bookedShare(2 * TICKS_PER_HOUR)).toBeGreaterThan(0.8);
    expect(bookedShare(2 * TICKS_PER_HOUR)).toBeLessThan(0.9);
  });

  it("has business book latest and economy earliest", () => {
    const t = 3 * TICKS_PER_HOUR;
    expect(classBookedShare("business", t)).toBeLessThan(classBookedShare("first", t));
    expect(classBookedShare("first", t)).toBeLessThan(classBookedShare("economy", t));
    expect(classBookedShare("business", BOOKING_WINDOW_TICKS)).toBeCloseTo(
      1 - CLASS_LATE_SHARE.business,
    );
    expect(classBookedShare("economy", 0)).toBe(1);
  });
});
