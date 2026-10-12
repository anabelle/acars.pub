# S70 — Booking curve (fares while filling, visual first)

> **Status:** ◐ in progress
> **Next step:** S70.2 — web: booking bars fill toward departure; plane panel bookings card
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** — (next)
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
- [ ] **S70.2** Web: booking bars fill toward departure on both boards ("filling" look), plane panel bookings card; i18n; tests.
- [ ] **S70.3** e2e (desktop and phone), screenshots, PR.

## Progress log

2026-10-12 · brief · (this commit) · Written after the owner's D13 "show filling, decide later" and a read of the S63 booking bars (they show the last landing's load factor today).

2026-10-12 · S70.1 · (this commit) · **The curve, in core.** `booking.ts`: `bookedShare` (100 % at departure, half of the bookings in the last 24 h, `1 − 0.5 · (h/24)^0.6`), `classBookedShare` (business 70 % late, first 60 %, economy 40 %), `BOOKING_WINDOW_TICKS`, `LATE_BOOKING_SHARE`, `CLASS_LATE_SHARE`. Display only. 4 tests; core 449/449, 100 % functions.
