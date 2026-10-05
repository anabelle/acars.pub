# S12 — Lease vs buy, tier pacing, milestone rungs

> **Status:** ☐ not started · **Track:** Economy · **Size:** M · **Depends on:** S11 · **Unblocks:** S31 (milestone data), S32
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Target: buying beats leasing after 3–5 years of operation, accounting for resale/book value.
- Re-tune tier thresholds with the S02 strategy sims. Targets: balanced player → Tier 2 in 1–3 days, Tier 3 in 3–4 weeks; greedy shouldn't be more than 2× faster than balanced.
- Milestones between tiers (first $1M, 10k pax, first jet, 5 routes, …), each a pure function of airline state with small fixed-point rewards.

## Acceptance criteria

- [ ] The S02 strategy table hits the targets; milestone conditions have unit tests.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
