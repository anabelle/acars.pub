# S66 — Lines of flying, buffers, knock-on delays

> **Status:** ◐ in progress
> **Next step:** S66.2 — store: set a line (action + reducer), fly it (live and catch-up)
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
- [ ] **S66.2** Store: `AIRCRAFT_LINE_SET` action (validate: own plane, routes active and in range, line starts at the plane's base), reducer, engine (live and reconcile) flying lines with per-leg economics; route frequency/assignment from lines. _Done when:_ engine tests (live = catch-up, landings and money per leg, delays).
- [ ] **S66.3** UI: the plane's 24-hour board (legs on a day strip, buffers, on-time %), build a line from the plane's routes, auto-fill.
- [ ] **S66.4** On-time performance: per plane and airline (last 7 days), ACARS shows delays.
- [ ] **S66.5** e2e (desktop and phone) + screenshots; PR.

## Acceptance criteria

- [ ] A player can give a plane a line of 2+ legs over different routes and see it fly them, every day, with UTC times.
- [ ] Delays appear, are absorbed by buffers, and knock on when they are not; the same on every client.
- [ ] Planes without a line behave exactly as before; perf probes and full e2e green.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-12 · brief · (this commit) · Written after the owner's D9 "yes" and a read of the cycle algebra (`cycle.ts`) and both engine paths (`processFlightEngine` live, `reconcileFleetToTick` catch-up, also used for rivals).

2026-10-12 · S66.1 · (this commit) · **The line, in core.** `line.ts`: validation (empty, too many legs, bad offset, not chained, not closed, overlap, too long), deterministic disruption, `lineDay` (knock-on with the no-spill cap: each leg's latest departure keeps the rest of the day before the next first departure), `linePhaseAt` (enroute / turnaround / idle with next departure), `lineLandingsBetween` (newest `max`), `lineLandingCount` (edges walked, whole days counted). Types: `AircraftInstance.line`, `FlightState.routeId`. Core 415/415.

2026-10-12 · S66.2 WIP · (this commit) · Landing money extracted from the live loop into `computeLandingEconomics` (same body, side effects left in the caller) so line legs can share it; `buildLineService` + `FlightPassengerInput.lineService` let a route count the round trips its line planes fly (cycle planes keep their own count). No behaviour change: store 282/282. Remaining: the line action and reducer, the line engine (live + catch-up), store method.
