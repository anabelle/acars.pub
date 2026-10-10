# S58 — Utilization fix: planes fly their day

> **Status:** ☐ not started
> **Next step:** S58.1
> **Branch:** —
> **PR:** —
>
> **Track:** Economy/UX · **Size:** M (3 steps) · **Depends on:** S14 · **Unblocks:** S64 · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) Wave A
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

A plane you pay for should fly most of its day. Today it mostly waits on the ground, and adding a plane to a route makes every plane on it fly less.

## Why (evidence)

- Owner, 2026-10-10: "I see now all my planes grounded most of the time."
- Routes open at `frequencyPerWeek = 7` (`networkSlice.ts`, route launch) and nothing raises it when a plane is assigned.
- `scheduledRoundTripTicks` (`packages/core/src/cycle.ts`) spreads the weekly frequency across the assigned planes: with 7/week, 2 planes each fly every other day.
- An ATR on MAD–BCN (round trip ~3 h) flies ~3 h a day at 7/week; its physical maximum is ~56/week. Real short-haul flies 10–13 block hours a day.

## Read first

- `packages/core/src/cycle.ts` (`scheduledRoundTripTicks`, `maxWeeklyFrequency`, `scheduledWeeklyFrequency`)
- `packages/store/src/slices/networkSlice.ts` (route launch, assign/unassign, `updateRouteFrequency`)
- `packages/store/src/actionReducer.ts` (`ROUTE_*` actions: the reducer must agree with the slice)
- `apps/web/src/features/network/components/RouteFrequencyControl.tsx`, `RouteDecisionCard.tsx`
- `packages/store/src/balance/` and `docs/overhaul/balance/` (S02 harness: measure before and after)

## In scope

- A sensible starting frequency for a new route: what its first plane can fly in a working day (target ~12 block hours, capped by the physical maximum and by demand), instead of a flat 7.
- Assigning a plane raises the route's frequency by that plane's share (and unassigning lowers it), unless the player has set the frequency by hand since; the player's explicit choice always wins.
- An "idle" signal: block hours per day per plane, with a warning when under ~6 h, on the plane, the route and the cockpit; one-tap "fly more" that raises frequency to the suggested value.
- Reducer and slice agree; catch-up equals live ticking (existing S14 tests extended).

## Out of scope

- Lines of flying (a plane on several routes) — that is D9 / S66.
- What-if curves (S64).

## Steps (checkpoints)

- [ ] **S58.1** Core: `suggestedWeeklyFrequency(legs, aircraftCount, demand)` (pure, O(1)) and the "manual frequency" flag on routes. Route launch and assign/unassign use it in slice and reducer. _Done when:_ core + store tests (launch, assign, unassign, manual override, catch-up = live).
- [ ] **S58.2** Balance check with the S02 harness: utilization, load factor and profit per plane before/after; adjust the target if load factors collapse. _Done when:_ a short before/after table in this brief.
- [ ] **S58.3** UI: block hours per day on plane, route and cockpit; idle warning and one-tap "fly more"; en/es. _Done when:_ component tests + e2e (launch → assign second plane → frequency rises; idle warning appears and clears) + desktop and phone screenshots.

## Acceptance criteria

- [ ] A new route's first plane flies ≥ 8 block hours a day where demand allows.
- [ ] Adding a plane to a route never lowers how much each plane flies (unless the player set the frequency by hand).
- [ ] Idle planes are visible with a one-tap fix.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-10 · brief · (this commit) · Written from the 2026-10-10 planning session (Blueprint v2, Wave A).
