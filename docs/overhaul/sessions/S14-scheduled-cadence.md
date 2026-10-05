# S14 — Flights follow the route schedule

> **Status:** ☐ not started
> **Next step:** S14.1
> **Branch:** —
> **PR:** —
>
> **Track:** Economy · **Size:** L (4 steps) · **Depends on:** S02, decision D8 (decided: respect the frequency) · **Unblocks:** S10 (calibration), S24 (fare editor numbers)
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Aircraft fly the route's weekly frequency, not back to back. Frequency becomes a real decision, and profit per day becomes predictable and matches what the UI projects.

## Why (evidence)

- S02 baseline: an ATR 72 flies **17.6 MAD–BCN legs a day**, because `frequencyPerWeek` only splits demand and never limits flying. The S23 route card assumes the stored 7/week (2 legs/day), so it understates daily profit ~8–9×.
- Decision D8 (2026-10-05): respect the route frequency.

## Read first

- `packages/core/src/cycle.ts` (`getCyclePhase`)
- `packages/store/src/FlightEngine.ts`: the idle → takeoff transition and `reconcileFleetToTick` (catch-up uses the cycle math, so both must agree)
- `packages/store/src/routeProjection.ts` (`flightsPerDay`)
- `packages/store/src/balance/` (S02) and `docs/overhaul/balance/baseline-v1.md`

## In scope

- Pure schedule math in core: a route with weekly frequency `F` (round trips) has departure slots every `TICKS_PER_WEEK / F` ticks from the origin, phase-anchored deterministically (e.g. to the route id hash) so routes don't all depart at once. Assigned aircraft take slots in turn; no aircraft departs more often than its physical cycle allows (block time + turnaround). Pure and O(1) per aircraft.
- Engine: an idle, assigned aircraft waits for its next slot instead of departing immediately. `reconcileFleetToTick` uses the same math, so catch-up equals live ticking.
- Frequency per route is editable (route manager, sensible default on open), capped at the physical maximum for the assigned fleet. Reducer and slice validate it.
- Projection and route card use the scheduled frequency.

## Out of scope

- Market model or price elasticity (S10). Slot scarcity at airports.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S14.1** Schedule math in core (`getNextDepartureTick(route, aircraftIndex, aircraftCount, tick, cycleTicks)`, `maxWeeklyFrequency`) + unit tests. _Done when:_ tests green.
- [ ] **S14.2** Engine and catch-up follow the schedule; existing engine tests updated where they assumed back-to-back flying. _Done when:_ live-ticking vs `reconcileFleetToTick` equivalence test green; `pnpm balance` shows legs/day = scheduled frequency.
- [ ] **S14.3** Editable frequency (UI + reducer validation, cap shown). _Done when:_ unit tests + e2e of changing a frequency.
- [ ] **S14.4** Projection/route card use the schedule; regenerate `latest.md` and commit the before/after in the PR. _Done when:_ route card profit/day matches the engine (projection test) and the S30 away report agrees with it.

## Details & guidance

- D2 (decided): there are no real players, so change the engine in place. No ruleset versioning, no activation tick. Existing airlines simply follow the new rules on their next load.
- Pick a default frequency that keeps a new player's first route profitable at suggested fares (check with `pnpm balance`), and show the physical cap next to the input.
- Keep it O(1): no per-slot loops over the week; compute the next slot arithmetically.

## Acceptance criteria

- [ ] Legs/day in the S02 report equal the scheduled frequency (capped by physics); route card profit/day equals the engine's; catch-up equals live ticking.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
