# S58 — Utilization fix: planes fly their day

> **Status:** ◐ in progress
> **Next step:** S58.3
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
- [x] **S58.2** D19 approved. Economy calibration for real utilization: per-flight margins so a plane flying 10–13 block hours earns a realistic margin over its lease; S02 harness before/after. _Done when:_ a before/after table here and the owner's sign-off.
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

2026-10-10 · S58.2 · (this commit) · **Economy recalibrated for real utilization (D19 approved: "recalibrate, realism is important for playability").**

- **Costs** (`packages/core/src/finance.ts`): ground handling per departure ($150 + $6/seat), passenger service ($4/pax + $1.50/pax-hour), distribution 6% of revenue, overhead 5% → 8%, and 0.3 h of fuel per cycle (taxi, climb). Timeline costs gain optional `handling` and `distribution`.
- **Fares** taper with distance: economy `40 + 2.2·km^0.6` (was linear), business `100 + 2.5·km^0.75`; first unchanged. At 1,000 km: economy $179, business $545.
- **Tiers** (`tier.ts`): revenue thresholds ×3 (3M / 30M / 180M); route counts unchanged.
- **Projections**: route recommendations (decision card, opportunities, hub ideas) now project a new route at `bestWeeklyFrequency`, and report that frequency for S58.3 to apply.
- **Balance** (`docs/overhaul/balance/latest.md` §9–10), one aircraft at its suggested frequency, margin after lease:

| Route                   | Before (S58.1, profit/day) | After: profit/day after lease | Margin |
| ----------------------- | -------------------------- | ----------------------------- | ------ |
| ATR 72 MAD–BCN          | $40,274 − $5,200 lease     | $15,928                       | 13%    |
| Dash 8 MAD–BCN          | —                          | $31,118                       | 19%    |
| A320neo MAD–BCN         | $227,261 − $22,000 lease   | $151,472                      | 38%    |
| 787-9 JFK–LHR           | —                          | $52,623                       | 16%    |
| Thin (DEN–SLC, LIH–KOA) | —                          | losses (−22% to −77%)         | < 0    |

Day-one strategies at real utilization: Balanced reaches Tier 2 on day 4 and Tier 3 on day 31; Greedy 3 and 24; Cautious about break-even. **Note:** the A320 on dense short-haul is still rich (24–38%); log for fine-tuning. **Coupling:** at the opening 7/week every strategy now loses money, so S58.3 (apply the suggestion) must ship in this PR before merge.
