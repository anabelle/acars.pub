# S12 — Lease vs buy, tier pacing, milestone rungs

> **Status:** ◐ in progress
> **Next step:** S12.4
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #173
>
> **Track:** Economy · **Size:** M (4 steps) · **Depends on:** S11 · **Unblocks:** S31 (milestone data), S32
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Make fleet financing a real choice and give every player a reward cadence of days, not weeks.

## Why (evidence)

- Ledger A4/A5: pacing is bimodal and leasing is strictly dominant (16-year break-even).

## Read first

- `fleetSlice.ts` (purchase, lease deposit, buyout)
- `FlightEngine.ts` monthly lease
- `tier.ts`
- `docs/TIER_PROGRESSION.md`, `docs/FLEET_MANAGER_PLAN.md`

## In scope

- Ruleset: lease deposit %, lease rate formula, tier thresholds, new `MILESTONES` table (id, condition, reward)
- Docs: update `TIER_PROGRESSION.md`

## Out of scope

- Milestone UI (S31).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S12.1** Lease/buy parameters + TCO helper + tests. _Done when:_ break-even is 3–5 years.
- [x] **S12.2** Tier thresholds retuned with S02 strategies. _Done when:_ targets in brief met.
- [x] **S12.3** `MILESTONES` table + evaluators + tests. _Done when:_ tests green.
- [ ] **S12.4** Update `TIER_PROGRESSION.md`. _Done when:_ doc matches code.

## Details & guidance

- Target: buying beats leasing after 3–5 years of operation, accounting for resale/book value.
- Re-tune tier thresholds with the S02 strategy sims. Targets: balanced player → Tier 2 in 1–3 days, Tier 3 in 3–4 weeks; greedy shouldn't be more than 2× faster than balanced.
- Milestones between tiers (first $1M, 10k pax, first jet, 5 routes, …), each a pure function of airline state with small fixed-point rewards.

## Acceptance criteria

- [ ] The S02 strategy table hits the targets; milestone conditions have unit tests.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S12.1 · (this commit) · Lease vs buy. Core `fleet.ts` gains `LEASE_DEPOSIT_SHARE` 0.25 (non-refundable; was a hard-coded 0.1 in four places), `LEASE_MONTHLY_RATE` 0.006 of price (the catalog's `monthlyLease` is now derived from price; ATR 72 $120k→$156k, A320neo $380k→$660k), `SCRAP_RESALE_SHARE` 0.7, `ownershipCost` and `leaseBuyBreakEvenMonths`. `calculateBookValue` now depreciates continuously instead of in whole-year steps, which gives one clean crossover. Buying beats leasing from month 49 (~4.1 years) for every model (data test). A deposit below the 30% scrap loss keeps leasing cheaper at the start. The dealer copy shows the real deposit and the break-even month; the old copy claimed a refundable 10%. Day-one Greedy now fields 15 ATRs, not 37. S02 Balanced (2× fares) goes negative; S12.2 retunes the strategies and thresholds. The audit's '16-year' figure ignored resale: with resale the old terms broke even at ~12 years.
2026-10-06 · S12.2 · (this commit) · Tier thresholds: T2 $1M + 3 routes (was $5M), T3 $10M + 10 (was $50M), T4 $60M + 25 (was $250M). Strategies redefined for the post-S10/S11 economy: Balanced is 10 ATRs at 1.2× (top of the fair band), and Greedy is max lease (15 ATRs) at 1.4×, its revenue-maximising fare (5× now earns less than balanced). Result: Balanced reaches T2 on day 3 and T3 on day 28; Greedy on days 3 and 21 (1.3×); Cautious T2 on day 11. Asserted in `report.test.ts`; the report's tier note is now generated from `TIER_THRESHOLDS`. T4 is not reachable by a static day-one fleet within a year (it needs 25 routes), which is by design, since growth is the game.
2026-10-06 · S12.3 · (this commit) · Core `milestones.ts`: `MILESTONES` has 16 rungs, each a target on one metric (active routes, cumulative revenue, fleet size, owned aircraft, jets, widebodies, hubs, brand) with a fixed-point reward from $100k to $2M ($9.15M in total). It has rungs before T2, between T2 and T3, and between T3 and T4. Evaluators are pure: `milestoneState` (takes a model-type lookup, so core doesn't import the catalog), `isMilestoneMet`, `milestoneProgress` (brand is measured from 0.5), `newlyMetMilestones` and `nextMilestones`. Every condition has a just-below / at-target test. Rewards are not credited yet (see Follow-ups).

## Follow-ups

- **Grant milestone rewards.** S12.3 ships the table and evaluators only. Crediting rewards must replay deterministically: store achieved ids on the airline, and have the tick/reducer credit `reward` once when `newlyMetMilestones` returns an id. Surface the rungs in the cockpit (`nextMilestones`) next to the tier bar from S31.
- **Passenger-count rungs** (e.g. "10k passengers", from the brief) need a cumulative passenger counter on the airline, which doesn't exist yet. Add the counter alongside `cumulativeRevenue` in the engine slice.

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
