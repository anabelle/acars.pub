# S14 — Flights follow the route schedule

> **Status:** ◐ in progress
> **Next step:** S14.4
> **Branch:** claude/zen-darwin-3op878
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

- [x] **S14.1** Schedule math in core (`getNextDepartureTick(route, aircraftIndex, aircraftCount, tick, cycleTicks)`, `maxWeeklyFrequency`) + unit tests. _Done when:_ tests green.
- [x] **S14.2** Engine and catch-up follow the schedule; existing engine tests updated where they assumed back-to-back flying. _Done when:_ live-ticking vs `reconcileFleetToTick` equivalence test green; `pnpm balance` shows legs/day = scheduled frequency.
- [x] **S14.3** Editable frequency (UI + reducer validation, cap shown). _Done when:_ unit tests + e2e of changing a frequency.
- [ ] **S14.4** Projection/route card use the schedule; regenerate `latest.md` and commit the before/after in the PR. _Done when:_ route card profit/day matches the engine (projection test) and the S30 away report agrees with it.

## Details & guidance

- D2 (decided): there are no real players, so change the engine in place. No ruleset versioning, no activation tick. Existing airlines simply follow the new rules on their next load.
- Pick a default frequency that keeps a new player's first route profitable at suggested fares (check with `pnpm balance`), and show the physical cap next to the input.
- Keep it O(1): no per-slot loops over the week; compute the next slot arithmetically.

## Acceptance criteria

- [ ] Legs/day in the S02 report equal the scheduled frequency (capped by physics); route card profit/day equals the engine's; catch-up equals live ticking.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

- 2026-10-05 · S14.1 · (this commit) · Changes in `packages/core/src/cycle.ts`:
  - `physicalRoundTripTicks`.
  - `scheduledRoundTripTicks(duration, turnaround, frequencyPerWeek, aircraftCount)`: each aircraft's period is `ceil(TICKS_PER_WEEK × aircraft / frequency)`, never shorter than the physical cycle. With no or zero frequency it flies back to back, which keeps legacy routes valid.
  - `maxWeeklyFrequency(duration, turnaround, aircraftCount)` and `nextDepartureTick(anchor, tick, period)`, both O(1).
  - `getCyclePhase`, `countLandingsBetween` and `enumerateFlightEvents` take an optional `roundTripTicks` (default: the physical cycle, so existing behavior is identical). The extra time is a new `"idle"` phase at the origin, whose `departureTick` is the next slot.
  - New `TICKS_PER_WEEK`. 7 new tests; the 287 existing core tests unchanged. `pnpm balance` output unchanged (not wired yet).
  - **Design for S14.2:** the engine anchors each aircraft's cycle at its existing cycle start, offset by `index × period / aircraftCount` so the route's aircraft spread over the period. The live engine holds an idle, assigned aircraft until `nextDepartureTick`, and catch-up passes the same period to the cycle helpers.
- 2026-10-05 · S14.2 · (this commit) · **Aircraft now fly the route's weekly frequency.**
  - Live engine: after the inbound turnaround at the origin, an aircraft goes `idle` and waits until one period after the outbound departure of the round trip it just finished (`nextScheduledOutboundTick`). The first departure after assignment or delivery is still immediate, so the S23 "flying in 3 min" still holds.
  - Catch-up (`reconcileFleetToTick`): every path uses the same period (`routeRoundTripTicks` = `scheduledRoundTripTicks(…, route.frequencyPerWeek, assigned aircraft)`), and an idle, waiting aircraft is anchored on its last round trip like the live engine.
  - The core idle phase now keeps the inbound leg in `flight` and reports the slot as `nextDepartureTick`.
  - New tests: 7/week flies one round trip a day on the same slot; a frequency above physics still flies back to back; **catch-up lands the same flights at the same ticks as live ticking**, with the same final state.
  - The 28 existing reconcile tests pin the cycle mechanics, so their routes use `BACK_TO_BACK` (above the physical maximum).
  - Harness: legs/day = 2 × day ÷ the scheduled period (frequency parameter, default 7 = `openRoute`). `latest.md`: every route at 7/week flies **2.0 legs/day** (was 14–26). The ATR on MAD–BCN makes $6,113/day (was $53,838). Strategies: cautious 55 days to Tier 2 (was 13); greedy still reaches Tier 4 in 50 days (overpricing: S10).
  - The fix also stops demand being counted many times over: the engine splits weekly demand by `frequencyPerWeek` per leg, but flew ~8× that many legs.
  - **Found by e2e:** the S30 away report labelled a route by the newest landing's direction ("BCN ⇄ MAD" when only the return leg landed). `summarizeTimeline` now takes the airline's routes and labels each as the player opened it; the hook passes them in. New unit test.
  - Tooling: the pre-commit ESLint failed when one commit touched both `apps/web` and `packages/` ("multiple candidate TSConfigRootDirs"). Both ESLint configs now pin `parserOptions.tsconfigRootDir`.
  - Gate: lint, typecheck, all unit tests, 17 e2e.
- 2026-10-05 · S14.3 · (this commit) · Changes:
  - **New action `ROUTE_UPDATE_FREQUENCY`** (core type). The reducer clamps it to [1, 1000] like `ROUTE_OPEN` (`MIN_/MAX_ROUTE_FREQUENCY_PER_WEEK` in core), ignores garbage and unknown routes, and adds a `route_change` timeline entry. The slice's `updateRouteFrequency` is optimistic, uses the same clamp, rolls back on publish failure, and skips no-op changes.
  - Core `legTicksFor(distance, speed, turnaround)`: the single source for leg/turnaround ticks, used by the engine and the UI.
  - **`RouteFrequencyControl`** in each active route row (own airline only): a −/+ stepper with a local draft that publishes one action on "Apply". It shows legs/day and the physical cap for the assigned fleet (the slowest aircraft sets the pace), or "Assign an aircraft to fly it". en + es.
  - Tests: reducer set/clamp/garbage/unknown (2); control steps, applies once, stops at the physical cap, floors at 1 (3); e2e `route-frequency.spec.ts` launches MAD→BCN, takes it from 7/wk (2.0 legs/day) to 9/wk (2.6 legs/day).
  - Default on open stays 7/week; the route card's projection already uses the stored frequency.
  - Gate: lint, typecheck, all unit tests, 18 e2e; `pnpm balance` unchanged.

## Follow-ups

- **Frequency must scale with the fleet (S14.3):** at a fixed 7/week, extra aircraft on a route fly nothing extra (the period is spread over them). S14.3's editor and default must raise the frequency when aircraft are added, or the "Oversupply" table and multi-aircraft routes mean little.
- **Departure stagger:** aircraft assigned at the same tick depart together and stay bunched. Cosmetic (demand is split by frequency); spread them by `index × period / aircraftCount` if it shows on the map.

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
