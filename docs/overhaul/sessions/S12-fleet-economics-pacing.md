# S12 — Lease vs buy, tier pacing, milestone rungs

> **Status:** ☐ not started
> **Next step:** S12.1
> **Branch:** —
> **PR:** —
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

- [ ] **S12.1** Lease/buy parameters + TCO helper + tests. _Done when:_ break-even is 3–5 years.
- [ ] **S12.2** Tier thresholds retuned with S02 strategies. _Done when:_ targets in brief met.
- [ ] **S12.3** `MILESTONES` table + evaluators + tests. _Done when:_ tests green.
- [ ] **S12.4** Update `TIER_PROGRESSION.md`. _Done when:_ doc matches code.

## Details & guidance

- Target: buying beats leasing after 3–5 years of operation, accounting for resale/book value.
- Re-tune tier thresholds with the S02 strategy sims. Targets: balanced player → Tier 2 in 1–3 days, Tier 3 in 3–4 weeks; greedy shouldn't be more than 2× faster than balanced.
- Milestones between tiers (first $1M, 10k pax, first jet, 5 routes, …), each a pure function of airline state with small fixed-point rewards.

## Acceptance criteria

- [ ] The S02 strategy table hits the targets; milestone conditions have unit tests.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
