# S10 — Market model v2: incumbent carriers + distance-scaled fare cap

> **Status:** ◐ in progress
> **Next step:** S10.3
> **Branch:** claude/zen-darwin-3op878
> **PR:** —
>
> **Track:** Economy · **Size:** L (5 steps) · **Depends on:** S14, decision D1 (decided: real market) · **Unblocks:** S11
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Make route choice and pricing real decisions: big markets are contested and price-sensitive; thin markets are small but uncontested.

## Why (evidence)

- Ledger A1, A2, A7: one aircraft fills any market and 40× fares stay full on big routes.

## Read first

- `packages/core/src/qsi.ts` (`calculateShares`, `allocatePassengers`)
- `packages/core/src/demand.ts`
- `FlightEngine.ts` landing allocation
- S02 baseline report

## In scope

- Incumbent and fare-cap constants in `@acars/core` (changed in place, D2)
- A pure `getIncumbentOffer(route, demand)` in core: an NPC `FlightOffer` at the suggested fare, with frequency scaled to market size, travel time from distance, and fixed service/brand scores
- Include it in the offers passed to `allocatePassengers` (one extra offer, still O(1))
- Fare ceiling = `k × suggested` per class (a core constant), enforced in reducer and slice

## Out of scope

- Brand and oversupply changes (S11).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S10.1** `getIncumbentOffer` pure function + unit tests (not wired). _Done when:_ tests green.
- [x] **S10.2** Wire the incumbent offer into landing allocation and the fare cap into reducer + slice (constants in core, in place per D2). _Done when:_ engine tests green; `pnpm balance` regenerated.
- [ ] **S10.3** Calibrate with S02; commit before/after report. _Done when:_ README §6 balance targets met in the report.
- [ ] **S10.4** Selector exposing incumbent strength / projected share for UI. _Done when:_ unit tests green.
- [ ] **S10.5** Route card shows incumbent strength and the fare cap; commit `baseline-v2.md`. _Done when:_ screenshot + report committed.

## Details & guidance

- Calibrate with S02 so that:
  - the profit-maximizing fare is 0.8–1.6× suggested on every market;
  - a single ATR on a big market gets a realistic share (LF 60–85% at suggested fares);
  - thin markets reach a high share with lower absolute volume.
- Expose the incumbent in UI data so S23/S24 can show "incumbent strength".
- Before/after S02 tables in the PR.

## Acceptance criteria

- [ ] The metrics in README §6 "Decisions matter" and "No solved optimum" are met in the S02 report.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

- 2026-10-05 · S10.1 · (this commit) · **Design change from the brief, and why.** The brief adds the incumbent as one more offer in the QSI split. That can't work: QSI is a weighted sum where price is 40% of economy and frequency 15%, so two equally priced offers split a market roughly in half whatever their frequencies. A single ATR would keep tens of percent of MAD–BCN (~140k addressable pax/week) and fill at any fare.
  - **Instead, two stages:** (1) the players' share against the incumbent is **frequency × attractiveness**, with attractiveness = fareRatio^-k; (2) that share is split among players with the existing QSI, unchanged.
  - The incumbent's frequency is sized from the market: demand ÷ (its seats × 0.8 target LF). Its seats grow with distance: 120 / 160 / 250 / 300.
  - So a player leg draws roughly **one incumbent planeload** of demand whatever the market size, and the engine's existing price elasticity starts to bite.
  - Markets that can't sustain 3 incumbent round trips a week have no incumbent and stay uncontested.
  - `packages/core/src/incumbent.ts`: `getIncumbentOffer`, `entrantMarketShare`, `incumbentSeatsPerFlight` and the tuning constants (`INCUMBENT_TARGET_LOAD_FACTOR`, `INCUMBENT_MIN_WEEKLY_FREQUENCY`, `INCUMBENT_FARE_SENSITIVITY`), calibrated in S10.3. Pure; `detPow` for determinism. 7 tests, 100% coverage. Not wired yet.
- 2026-10-05 · S10.2 · (this commit) · Changes:
  - **Wired.** `computeFlightPassengers` sizes the incumbent from the addressable weekly demand, gives the players `entrantMarketShare` of each class (every player offer's frequency × fareRatio^-1), and splits that with the existing QSI. The projection and route card share the function, so they follow.
  - **Fare cap:** core `FARE_CAP_MULTIPLIER = 3` and `getMaxFares(distance)`. It's enforced in the reducer (`ROUTE_OPEN`, `ROUTE_UPDATE_FARES`), the optimistic slice (same clamp), and the engine, so routes saved above the cap fly at the cap (D2).
  - Tests: all 230 existing store tests pass unchanged; new reducer test for the cap on open and update; core test for `getMaxFares`. Coverage gate, 264 web unit tests and 18 e2e green.
  - **Uncalibrated result (`latest.md`), the input for S10.3:**
    - The overpricing exploit is gone: the best fare is 1× everywhere; the greedy 5× strategy loses $518k/day; MAD–BCN at 40× flies at 3% LF.
    - Too steep, though: at 1.5× load factor drops to ~33% (target: best fare 0.8–1.6×). Price is penalised twice, by the share term and the engine's −1.2 elasticity.
    - LIH–KOA now meets a small incumbent and falls to 14%; thin markets should be uncontested.
    - A player leg draws ~one incumbent planeload whatever its own size, so an A320 at 7/week flies at ~22%; the incumbent's gauge should grow with market size.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
