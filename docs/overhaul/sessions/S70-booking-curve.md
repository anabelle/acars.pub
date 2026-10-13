# S70 — Booking curve (fares while filling, visual first)

> **Status:** ☑ merged
> **Next step:** — (merged in #201)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #201 (with S68, S69)
>
> **Track:** Decisions · **Size:** S (3 steps) · **Depends on:** D13 ✅ (2026-10-12: "show filling, decide later"), S63 · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §4 Decisions

> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Flights fill over the hours before departure, the way real ones do: departure boards show bookings climbing toward the flight's expected load, and a plane on the ground shows how many seats are still to sell and who buys them late (business travellers). Visual only (D13): revenue is unchanged until the owner decides whether the last bucket's fare should matter.

## Design

- **Curve (core, pure):** `bookedShare(ticksToDeparture)` — the share of a flight's final bookings already sold. Half of them come in the last 24 h (`LATE_BOOKING_SHARE`), more of them the closer departure gets (`1 − 0.5 · (h/24)^0.6`); 100 % at departure. Per class, business books latest (70 % late), first 60 %, economy 40 %.
- **Expected final load:** the plane's last known load factor (the engine's own number); no load yet → no bar (as today).
- **Boards:** departures not yet flown show the climbing booking share (marked as still filling); flights in the air and arrivals keep the final load.
- **Plane panel:** for a plane on the ground with a next departure: booked now, seats still expected to sell, and that most of them are business.
- **Bounded:** one formula per row on screen; nothing stored, nothing per passenger, no effect on the replay or money.

## Steps (checkpoints)

- [x] **S70.1** Core: `bookedShare`, `classBookedShare`, constants; tests.
- [x] **S70.2** Web: booking bars fill toward departure on both boards ("filling" look), plane panel bookings card; i18n; tests.
- [x] **S70.3** e2e (desktop and phone), screenshots, PR.

## Progress log

2026-10-12 · brief · (this commit) · Written after the owner's D13 "show filling, decide later" and a read of the S63 booking bars (they show the last landing's load factor today).

2026-10-12 · S70.1 · (this commit) · **The curve, in core.** `booking.ts`: `bookedShare` (100 % at departure, half of the bookings in the last 24 h, `1 − 0.5 · (h/24)^0.6`), `classBookedShare` (business 70 % late, first 60 %, economy 40 %), `BOOKING_WINDOW_TICKS`, `LATE_BOOKING_SHARE`, `CLASS_LATE_SHARE`. Display only. 4 tests; core 449/449, 100 % functions.

2026-10-12 · S70.2 · (this commit) · **Filling, on screen.**

- Boards: `bookingsSoFar` (flight board utils) gives a departure still on the ground its expected load × `bookedShare`, marked `filling`; flights in the air, departed ones and arrivals keep the load itself. Both the airport board and the airline board use it. `BookingBar` pulses and adds "↑" while filling (aria "62% ↑").
- Plane panel: `NextDepartureBookingsCard` (fleet) for a plane turning around: "Next departure 14:20 · bookings", "112 of 170 seats sold", "About 24 more expected before departure, 6 of them business or first: they book late." (`nextDepartureBookings`, per-cabin curves).
- i18n en/es `bookings.*`. Tests: utils (counts, climbing, nulls), card (premium and plain wording, hidden cases), bar (filling mark). Web 697/697.

2026-10-12 · S70.3 · (this commit) · **On screen.** e2e `booking-curve.spec.ts` (1440) and `mobile-booking-curve.spec.ts` (390): a two-route Madrid airline flies two hours, then the clock steps five minutes at a time until a plane turns around: its panel shows "Next departure HH:MM · bookings", "N of M seats sold", "more expected before departure" and a filling bar; Madrid's departures board shows a filling bar ("85% ↑"). Screenshots: `media/s70/next-departure-bookings-{1440,390}.png`, `media/s70/booking-bars-filling-{1440,390}.png`. Ships in #201 (same branch).

2026-10-12 · merged · — · Merged in #201 (with S68–S74).
