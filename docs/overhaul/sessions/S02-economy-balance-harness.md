# S02 — Economy balance harness

> **Status:** ☐ not started
> **Next step:** S02.1
> **Branch:** —
> **PR:** —
>
> **Track:** Foundations · **Size:** M (4 steps) · **Depends on:** — · **Unblocks:** S03, S10, S11, S12
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

One command that runs the **real** flight engine over a matrix of scenarios and prints a balance report, so every economy change has a before/after table.

## Why (evidence)

- Audit numbers were first produced by a re-implementation and later corrected against the real engine (ledger A2–A4). Make the real engine the only source of truth.

## Read first

- `packages/store/src/FlightEngine.ts` (`processFlightEngine`, `estimateLandingFinancials`)
- `packages/store/src/FlightEngine.test.ts` (`makeAircraft`, `makeRoute`, `simulateSingleLanding` fixtures)
- `docs/ECONOMIC_MODEL.md`

## In scope

- Move the fixtures into `packages/store/src/testing/engineFixtures.ts` (re-export them in the existing test)
- New `packages/store/src/balance/` (scenario matrix + report)
- Root script `pnpm balance` → writes `docs/overhaul/balance/latest.md`

## Out of scope

- Any formula or constant change.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S02.1** Move engine fixtures to `src/testing/engineFixtures.ts` (re-exported; no behavior change). _Done when:_ existing tests green.
- [ ] **S02.2** Scenario matrix + per-landing metrics + markdown report writer. _Done when:_ report lists LF/profit for the matrix.
- [ ] **S02.3** Strategy sims (cautious / greedy / balanced) with days-to-tier. _Done when:_ report includes the strategy table.
- [ ] **S02.4** `pnpm balance` script + commit `docs/overhaul/balance/baseline-v1.md` + generator smoke test. _Done when:_ baseline matches ledger A1–A4.

## Details & guidance

- Scenarios: market size (JFK–BOS, MAD–BCN, MAD–LIS, DEN–SLC, a thin island pair), fare multiplier (0.5–40×), aircraft count per route (1, 3, 10), aircraft family (ATR 72, Q400, A320neo, 787-9 on a long route).
- Metrics per scenario: LF, pax, revenue/leg, profit/leg, profit/day, the profit-maximizing fare multiplier, and the share of profit captured by overpricing.
- Strategy sims (pure function over N simulated days): _cautious_ (3 planes, suggested fares), _greedy_ (lease max, 5× fares), _balanced_. Output days to Tier 2/3/4.
- Commit the baseline report as `docs/overhaul/balance/baseline-v1.md`.
- Add a `balance.test.ts` that asserts the report generator runs (not the balance values; those change in later sessions).

## Acceptance criteria

- [ ] `pnpm balance` reproduces ledger A1–A4 numbers (within rounding) and commits the baseline.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
