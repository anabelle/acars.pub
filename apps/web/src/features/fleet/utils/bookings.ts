import type { AircraftInstance } from "@acars/core";
import { classBookedShare } from "@acars/core";

export interface NextDepartureBookings {
  departureTick: number;
  /** Seats sold so far, and expected by departure (from the plane's last load factor). */
  booked: number;
  expected: number;
  seats: number;
  /** Seats still to sell before departure, and how many of them business and first. */
  toSell: number;
  premiumToSell: number;
}

/**
 * Bookings for a plane's next departure (S70, visual): its expected load (the
 * last known load factor, per cabin) scaled by each cabin's booking curve.
 * Null unless the plane is on the ground with a departure still to come.
 */
export function nextDepartureBookings(
  aircraft: Pick<
    AircraftInstance,
    "status" | "turnaroundEndTick" | "lastKnownLoadFactor" | "configuration"
  >,
  tick: number,
): NextDepartureBookings | null {
  const departureTick = aircraft.turnaroundEndTick;
  const load = aircraft.lastKnownLoadFactor;
  if (aircraft.status !== "turnaround" || departureTick === undefined || load === undefined) {
    return null;
  }
  if (departureTick <= tick) return null;
  const until = departureTick - tick;
  const cabins = ["economy", "business", "first"] as const;
  let booked = 0;
  let expected = 0;
  let premiumToSell = 0;
  for (const cabin of cabins) {
    const final = load * aircraft.configuration[cabin];
    const sold = final * classBookedShare(cabin, until);
    expected += final;
    booked += sold;
    if (cabin !== "economy") premiumToSell += final - sold;
  }
  const seats =
    aircraft.configuration.economy + aircraft.configuration.business + aircraft.configuration.first;
  const roundedBooked = Math.round(booked);
  const roundedExpected = Math.round(expected);
  return {
    departureTick,
    booked: roundedBooked,
    expected: roundedExpected,
    seats,
    toSell: Math.max(0, roundedExpected - roundedBooked),
    premiumToSell: Math.round(premiumToSell),
  };
}
