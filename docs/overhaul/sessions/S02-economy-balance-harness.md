# S02 — Economy balance harness

> **Status:** ◐ in progress
> **Next step:** S02.4
> **Branch:** claude/zen-darwin-3op878
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

- [x] **S02.1** Move engine fixtures to `src/testing/engineFixtures.ts` (re-exported; no behavior change). _Done when:_ existing tests green.
- [x] **S02.2** Scenario matrix + per-landing metrics + markdown report writer. _Done when:_ report lists LF/profit for the matrix.
- [x] **S02.3** Strategy sims (cautious / greedy / balanced) with days-to-tier. _Done when:_ report includes the strategy table.
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

- 2026-10-05 · S02.1 · (this commit) · Engine fixtures (`PLAYER_PUBKEY`, `EngineState`, `makeAircraft`, `makeRoute`, `initState`, `runTick`, `findLastEvent`, `simulateSingleLanding`, `makeFlight`) moved verbatim from `FlightEngine.test.ts` to `packages/store/src/testing/engineFixtures.ts` and imported back. They are not exported from the package index, so the app bundle is unchanged. Same 222 store tests pass.
- 2026-10-05 · S02.2 · (this commit) · Changes:
  - `packages/store/src/balance/legScenario.ts#runLegScenario` flies one leg through the real `processFlightEngine`: solo market, brand 0.5, tick 1 (fixed fuel and season), N aircraft assigned so demand splits as in the engine. It reads LF, passengers, revenue and profit per leg, plus the **real cadence**: legs/day = 24 h ÷ (block time + turnaround), taken from the landed aircraft's `turnaroundEndTick`.
  - `report.ts#generateBalanceReport` writes four markdown tables: market size (5 markets × ATR 72/A320neo), a fare sweep from 0.5× to 40× with the best multiplier and the overpricing share, oversupply (1/3/10 aircraft), and aircraft families (ATR 72, Q400, A320neo, A320neo JFK–LAX, 787-9 JFK–LHR). It takes extra sections for S02.3.
  - Smoke test in `report.test.ts`.
  - **Reproduces the ledger:**
    - A1: MAD–BCN and DEN–SLC both 87% LF at suggested fares.
    - A2: MAD–BCN 40× gives $293,294 vs $3,056 profit/leg at 87% LF. DEN–SLC's best is 3×, and 40× still beats 1× by 3.4×.
    - A3: 10 ATRs on DEN–SLC give 14% LF.
  - **New finding:** the engine flies aircraft back to back: an ATR 72 does **17.6 legs/day on MAD–BCN** (an A320neo 21.5; a 787-9 3.4 on JFK–LHR). This matches the 9 legs in 12 h seen in the S30 e2e. `frequencyPerWeek` (7) does not cap flying, so the S23 card's "2 flights/day" understates daily profit about 8–9×. The LIH–KOA island pair has almost no demand (3% LF): thin markets are hard losses, not small wins.
- 2026-10-05 · S02.3 · (this commit) · Changes:
  - `balance/strategy.ts#simulateStrategy`: a pure O(days) day-one strategy sim from a MAD hub with $100M. One leased aircraft per route to the most populous airports between 250 km and the model's range (one per city, deterministic). Each route's economics come from a real engine leg at the back-to-back cadence. It charges the 10% deposit, the $100k slot fee and the daily lease, and adds revenue toward `evaluateTier`.
  - Report section 5. Results:

    | Strategy                                     | Profit/day | Days to T2 / T3 / T4          |
    | -------------------------------------------- | ---------: | ----------------------------- |
    | Cautious: 3 ATR 72s, 1×                      |      $131k | 13 / never (3 routes) / never |
    | Balanced: 10 ATR 72s, 2×                     |     $1.67M | 2 / 20 / never (10 routes)    |
    | Greedy: 37 ATR 72s (all the cash allows), 5× |     $19.8M | 1 / 3 / 11                    |

  - **Corrects ledger A4:** the cautious player reaches Tier 2 in **13 days, not 28**. The audit assumed a schedule, but the engine flies back to back. The rest of A4 (bimodal pacing, $100M funds ~37 leased planes on day one) is confirmed and sharper: greedy reaches Tier 4 in 11 days.

## Follow-ups

- **Route card cadence (S24/S10, high):** `projectRouteEconomics` derives flights/day from `frequencyPerWeek` (7 → 2/day), but the engine flies back to back (ATR 72 MAD–BCN: 17.6 legs/day). Either the engine should respect a schedule (a design decision with economy impact, S10) or the projection should use the cadence. Until then, the card's profit/day is about 8–9× too low.

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
