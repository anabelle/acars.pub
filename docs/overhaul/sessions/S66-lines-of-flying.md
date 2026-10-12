# S66 — Lines of flying, buffers, knock-on delays

> **Status:** ☑ done (awaiting merge)
> **Next step:** — (merge the PR)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** — (next)
>
> **Track:** Decisions · **Size:** L (5 steps) · **Depends on:** D9 ✅ (2026-10-12) · **Unblocks:** S67 hub banks, S69 timetables · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §6 Decisions ("Lines of flying")
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

A plane flies a daily line of several legs — MAD→BCN→LIS→MAD→BCN→MAD — instead of one route back and forth. The player shapes the day on a 24-hour board (or lets auto-fill do it); tight turnarounds earn more flights, buffers keep the day on time when departures slip, and a late leg knocks on to the next.

## Why

- Owner, 2026-10-12 (D9): "Yes, chains" — planning becomes a puzzle and planes stop sitting idle.
- One-route-per-plane wastes the day on short routes and forces one plane per city pair.

## Design

- **Line** (`@acars/core/line`): legs in flying order with scheduled departures within the UTC day, each with this plane's block time and turnaround; the last leg returns to the first leg's origin; the same every day from the first whole day after it is set.
- **Delays**: each departure gets a deterministic disruption (seeded by plane, day, leg: two in three on time, a few 5–90 min). A leg leaves at the later of its schedule and the plane being ready, plus its disruption — capped so the day always ends before the next day's first departure. Buffers (slack between a turnaround and the next scheduled departure) absorb disruption; what they cannot absorb knocks on. On time = within 15 minutes. Weather (S68) will add to the disruption.
- **Pure and O(legs)**: where a plane is at any tick, its landings in any span (exact counts for long absences in O(legs)), all computed from the line — live ticks and catch-up use the same functions, for own and rival fleets.
- **Compatibility**: planes without a line keep today's one-route cycle untouched. A plane with a line has no `assignedRouteId`; each leg's route lists the plane, and the route's weekly frequency counts the line's legs.

## Steps (checkpoints)

- [x] **S66.1** Core: `LineOfFlying`, `validateLine`, `departureDisruptionTicks`, `lineDay`, `linePhaseAt`, `lineLandingsBetween`, `lineLandingCount`; `AircraftInstance.line`, `FlightState.routeId`. _Done when:_ unit tests (validation, determinism, no spill, phases, counts = walk).
- [x] **S66.2** Store: `AIRCRAFT_LINE_SET` action (validate: own plane, routes active and in range, line starts at the plane's base), reducer, engine (live and reconcile) flying lines with per-leg economics; route frequency/assignment from lines. _Done when:_ engine tests (live = catch-up, landings and money per leg, delays).
- [x] **S66.3** UI: the plane's 24-hour board (legs on a day strip, buffers, on-time %), build a line from the plane's routes, auto-fill.
- [x] **S66.4** On-time performance: per plane and airline (last 7 days), ACARS shows delays.
- [x] **S66.5** e2e (desktop and phone) + screenshots; PR.

## Acceptance criteria

- [x] A player can give a plane a line of 2+ legs over different routes and see it fly them, every day, with UTC times.
- [x] Delays appear, are absorbed by buffers, and knock on when they are not; the same on every client.
- [x] Planes without a line behave exactly as before; perf probes and full e2e green.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-12 · brief · (this commit) · Written after the owner's D9 "yes" and a read of the cycle algebra (`cycle.ts`) and both engine paths (`processFlightEngine` live, `reconcileFleetToTick` catch-up, also used for rivals).

2026-10-12 · S66.1 · (this commit) · **The line, in core.** `line.ts`: validation (empty, too many legs, bad offset, not chained, not closed, overlap, too long), deterministic disruption, `lineDay` (knock-on with the no-spill cap: each leg's latest departure keeps the rest of the day before the next first departure), `linePhaseAt` (enroute / turnaround / idle with next departure), `lineLandingsBetween` (newest `max`), `lineLandingCount` (edges walked, whole days counted). Types: `AircraftInstance.line`, `FlightState.routeId`. Core 415/415.

2026-10-12 · S66.2 WIP · (this commit) · Landing money extracted from the live loop into `computeLandingEconomics` (same body, side effects left in the caller) so line legs can share it; `buildLineService` + `FlightPassengerInput.lineService` let a route count the round trips its line planes fly (cycle planes keep their own count). No behaviour change: store 282/282. Remaining: the line action and reducer, the line engine (live + catch-up), store method.

2026-10-12 · S66.2 · (this commit) · **Lines fly, live and in catch-up.**

- `lineEngine.ts` (store): `buildLineLegs` (route + direction → legs with this plane's timings; unknown, closed, out-of-range routes refused; `validateLine`), `parseLineLegRequests` (Nostr payload), `advanceLineAircraft` — position straight from the line; landings in the span paid with the full demand model live (`computeLandingEconomics`) or estimated from the last load factor in catch-up (≤200 events; landings beyond them paid at the sampled average, counted in O(legs)); takeoff events; wear; landing details carry `delayTicks`. A grounded plane stays on the ground. `applyAircraftLine` is the optimistic update.
- Engine: `processFlightEngine` and `reconcileFleetToTick` hand line planes to it (own and rival fleets). Market share counts line legs (`buildLineService`: a daily leg = half a round trip a week).
- Action `AIRCRAFT_LINE_SET` {aircraftId, legs[{routeId, direction, departOffsetTicks}]}: only on the ground, first leg from the plane's airport; lists the plane on each leg's route; empty legs clear it. A single-route assignment, unassign, route close or rebase clears a line. Store: `setAircraftLine` (returns an error code or null).
- Tests: build/refuse, three-day catch-up (every landing paid, delays recorded, position = line), **a day ticked live lands the same flights and ends where catch-up does**, optimistic set/clear and refusals, replay set and route-close. Store 290/290, core 415/415, web unit 664/664.
- Known approximations: maintenance and grounding pause a line, and the plane resumes wherever the line places it.

2026-10-12 · S66.3 · (this commit) · **Plan a plane's day.**

- `LineSection` in the plane panel (own planes, top of Info): the line's airports ("MAD→BCN→LIS→MAD"), legs and block hours, and a `LineBoard` — a 24-hour board with each leg as a bar (destination over it), its turnaround hatched, the gaps the buffers, now as a cyan line; or "Flies one route back and forth" with **Plan a day**.
- `LineBuilder` dialog: legs in order from where the plane is; the next leg picked from your routes touching the last airport (in range); departures in 15-minute steps, defaulting to ready + 30 min; buffers coloured (green, amber under 20 min, red when it would leave before ready); live check with the replay's own rules (`planLine` → `buildLineLegs`) and the error said plainly; **Auto-fill** (out-and-back trips from base, routes in turn, 06:00–23:30 UTC, always valid); save; "Fly one route instead" clears it. Can't save while flying.
- Line planes count as working everywhere a plane with a route did (`isWorking`): nav badge, cockpit idle list, Today's parked chapter, first-hour checklist, launch's plane picker, fleet list badges and ferry, hangar card (shows the chain, not "parked").
- Tests: `linePlan` (options, plan/buffers/errors, default departure, auto-fill valid, draft from line, helpers), `LineSection` (invite → auto-fill → save; leg by leg until home; existing line on the board). Web feature suites 437/437.

2026-10-12 · S66.4 · (this commit) · **On time, or not.** `onTimePerformance` (one pass: scheduled flights that left within 15 min, mean delay; null when nothing was scheduled). Today's summary adds "on time 75%" when line planes flew; the day plan shows "On time 82% of 34 flights · average delay 6 min · 7 days"; ACARS OUT messages carry "DLY 0:25" for departures 5+ min late. Tests: on-time (window, plane, threshold), Today, ACARS delay.

2026-10-12 · S66.5 · (this commit) · **e2e and screenshots; S66 complete.**

- **Fix found by the e2e:** tick 0 is 18:00 UTC (the genesis), so tick-days are not UTC days — lines planned for 06:00 would have flown at 15:00. Core now has `UTC_MIDNIGHT_OFFSET_TICKS`, `utcDayOf`, `utcDayStartTick`, `utcTimeOfDayTicks`; every line function works in real UTC days (test pins 2026-10-12T03:00Z = 03:00). The board's "now" uses it too; the engine's idle fast path counts line planes.
- e2e `lines` (desktop) and `mobile-lines` (phone), clock at 03:00 UTC: launch MAD–BCN and MAD–LIS, plan the first plane's day with auto-fill (8 legs, buffers 33–35 min, back at 20:00Z), save, fly six hours: the panel shows the chain, the board with now, "On time 100% of 2 flights", and ACARS.
- Screenshots: [`line-builder-1440`](../media/s66/line-builder-1440.png), [`line-builder-390`](../media/s66/line-builder-390.png), [`line-flying-1440`](../media/s66/line-flying-1440.png), [`line-flying-390`](../media/s66/line-flying-390.png).
