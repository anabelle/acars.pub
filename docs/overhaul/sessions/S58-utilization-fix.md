# S58 — Utilization fix: planes fly their day

> **Status:** ◐ in progress
> **Next step:** S58.2 (needs D19)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #195
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

- **No reducer change** (safer than the first draft): the client suggests a frequency and the player applies it with the existing `ROUTE_UPDATE_FREQUENCY` action, so replays and rivals' states are untouched.
- `bestWeeklyFrequency` (store, pure): the frequency that earns the route the most operating profit per day for its fleet, capped at an operating day (`OPERATING_HOURS_PER_DAY = 18` of cycles, ~12–13 block hours on short sectors).
- Route launch and adding a plane use the suggestion; the player's own frequency stays theirs (we only ever raise to the suggestion, never lower).
- An "idle" signal: block hours per day per plane, a warning under ~6 h, and one-tap "fly more" on plane, route and cockpit.

## Out of scope

- Lines of flying (a plane on several routes) — that is D9 / S66.
- What-if curves (S64).

## Steps (checkpoints)

- [x] **S58.1** `bestWeeklyFrequency` in `@acars/store` (pure, ~25 projections, operating-day cap) with tests. _Done when:_ store tests (beats 1/7/max, a second plane never flies less, deterministic, input untouched).
- [ ] **S58.2** **Needs D19.** Economy calibration for real utilization: per-flight margins so a plane flying 10–13 block hours earns a realistic margin over its lease; S02 harness before/after. _Done when:_ a before/after table here and the owner's sign-off.
- [ ] **S58.3** UI: launch and "add a plane" apply the suggestion; block hours per day on plane, route and cockpit; idle warning and one-tap "fly more"; en/es. _Done when:_ component tests + e2e (launch → frequency set; second plane → frequency rises; idle warning appears and clears) + 1440/390 screenshots.

## Acceptance criteria

- [ ] A new route's first plane flies ≥ 8 block hours a day where demand allows.
- [ ] Adding a plane to a route never lowers how much each plane flies (unless the player set the frequency by hand).
- [ ] Idle planes are visible with a one-tap fix.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-10 · brief · ba10e67 · Written from the 2026-10-10 planning session (Blueprint v2, Wave A).

2026-10-10 · S58.1 · d600093 · **`bestWeeklyFrequency`, and a finding that needs a decision.**

- **What:** `packages/store/src/routeProjection.ts` gains `bestWeeklyFrequency` and `OPERATING_HOURS_PER_DAY`; 3 new tests in `routeProjection.test.ts`. Nothing uses it yet.
- **Design change:** no reducer change. Frequency stays a player action (`ROUTE_UPDATE_FREQUENCY`); the client suggests it. Replays and rivals are untouched.
- **Finding (tick 1000, one aircraft, suggested fares):**

| Route           | Profit/day at 7/wk (LF) | Best  | Profit/day at best (LF) | Lease/day |
| --------------- | ----------------------- | ----- | ----------------------- | --------- |
| ATR 72 MAD–BCN  | $6,129 (87%)            | 46/wk | $40,274 (87%)           | $5,200    |
| A320neo MAD–BCN | $29,310 (75%)           | 56/wk | $227,261 (73%)          | $22,000   |
| ATR 72 PTY–SJO  | $6,761 (84%)            | 44/wk | $24,126 (67%)           | $5,200    |
| Dash 8 PTY–KIN  | $7,058 (63%)            | 14/wk | $9,082 (54%)            | $6,400    |
| 737-800 PTY–DFW | $136,229 (62%)          | 12/wk | $195,106 (54%)          | $21,200   |

Per-flight margins were calibrated (S10) while planes flew 7 a week. Letting planes fly a real day multiplies profit 3–8× on busy markets, and some long routes are already very rich at 7/wk. Shipping the utilization fix alone would inflate the economy, so S58.2 waits on **D19**.
