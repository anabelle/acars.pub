import type { AircraftInstance } from "@acars/core";
import { TICKS_PER_HOUR } from "@acars/core";
import { describe, expect, it } from "vitest";
import { bookingsSoFar } from "@/features/network/utils/flightBoard";
import { nextDepartureBookings } from "./bookings";

const plane = {
  status: "turnaround",
  turnaroundEndTick: 1000 + 2 * TICKS_PER_HOUR,
  lastKnownLoadFactor: 0.8,
  configuration: { economy: 150, business: 20, first: 0, cargoKg: 0 },
} as Pick<
  AircraftInstance,
  "status" | "turnaroundEndTick" | "lastKnownLoadFactor" | "configuration"
>;

describe("nextDepartureBookings (S70)", () => {
  it("counts seats sold so far and still to sell, premium ones last", () => {
    const b = nextDepartureBookings(plane, 1000);
    expect(b).not.toBeNull();
    if (!b) return;
    expect(b.seats).toBe(170);
    expect(b.expected).toBe(136);
    expect(b.booked).toBeLessThan(b.expected);
    expect(b.booked).toBeGreaterThan(100);
    expect(b.toSell).toBe(b.expected - b.booked);
    expect(b.premiumToSell).toBeGreaterThan(0);
    const later = nextDepartureBookings(plane, 1000 + 2 * TICKS_PER_HOUR - 10);
    expect(later?.booked ?? 0).toBeGreaterThan(b.booked);
  });

  it("is empty unless the plane waits on the ground for a departure with a known load", () => {
    expect(nextDepartureBookings({ ...plane, status: "enroute" }, 1000)).toBeNull();
    expect(nextDepartureBookings({ ...plane, turnaroundEndTick: undefined }, 1000)).toBeNull();
    expect(nextDepartureBookings({ ...plane, lastKnownLoadFactor: undefined }, 1000)).toBeNull();
    expect(nextDepartureBookings(plane, 1000 + 3 * TICKS_PER_HOUR)).toBeNull();
  });
});

describe("bookingsSoFar (S70)", () => {
  it("climbs toward the expected load before departure", () => {
    const soon = bookingsSoFar(plane, 1000 + TICKS_PER_HOUR, 1000);
    expect(soon.filling).toBe(true);
    expect(soon.loadFactor).toBeGreaterThan(0.6);
    expect(soon.loadFactor).toBeLessThan(0.8);
  });

  it("shows the load itself once flying, departed, or unknown", () => {
    expect(bookingsSoFar({ ...plane, status: "enroute" }, 5000, 1000)).toEqual({
      loadFactor: 0.8,
      filling: false,
    });
    expect(bookingsSoFar(plane, 900, 1000)).toEqual({ loadFactor: 0.8, filling: false });
    expect(bookingsSoFar({ ...plane, lastKnownLoadFactor: undefined }, 5000, 1000)).toEqual({
      loadFactor: undefined,
      filling: false,
    });
  });
});
