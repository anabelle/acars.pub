# S02 — Economy balance harness

> **Status:** ☐ not started · **Track:** Foundations · **Size:** M · **Depends on:** — · **Unblocks:** S03, S10, S11, S12
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Scenarios: market size (JFK–BOS, MAD–BCN, MAD–LIS, DEN–SLC, a thin island pair), fare multiplier (0.5–40×), aircraft count per route (1, 3, 10), aircraft family (ATR 72, Q400, A320neo, 787-9 on a long route).
- Metrics per scenario: LF, pax, revenue/leg, profit/leg, profit/day, the profit-maximizing fare multiplier, and the share of profit captured by overpricing.
- Strategy sims (pure function over N simulated days): _cautious_ (3 planes, suggested fares), _greedy_ (lease max, 5× fares), _balanced_. Output days to Tier 2/3/4.
- Commit the baseline report as `docs/overhaul/balance/baseline-v1.md`.
- Add a `balance.test.ts` that asserts the report generator runs (not the balance values; those change in later sessions).

## Acceptance criteria

- [ ] `pnpm balance` reproduces ledger A1–A4 numbers (within rounding) and commits the baseline.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
