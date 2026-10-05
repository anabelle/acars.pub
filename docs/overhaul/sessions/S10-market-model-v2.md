# S10 — Market model v2: incumbent carriers + distance-scaled fare cap

> **Status:** ☑ ready for review
> **Next step:** — (all steps done; awaiting review)
> **Branch:** claude/zen-darwin-3op878
> **PR:** https://github.com/anabelle/acars.pub/pull/165
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
- [x] **S10.3** Calibrate with S02; commit before/after report. _Done when:_ README §6 balance targets met in the report.
- [x] **S10.4** Selector exposing incumbent strength / projected share for UI. _Done when:_ unit tests green.
- [x] **S10.5** Route card shows incumbent strength and the fare cap; commit `baseline-v2.md`. _Done when:_ screenshot + report committed.

## Details & guidance

- Calibrate with S02 so that:
  - the profit-maximizing fare is 0.8–1.6× suggested on every market;
  - a single ATR on a big market gets a realistic share (LF 60–85% at suggested fares);
  - thin markets reach a high share with lower absolute volume.
- Expose the incumbent in UI data so S23/S24 can show "incumbent strength".
- Before/after S02 tables in the PR.

## Acceptance criteria

- [x] The metrics in README §6 "Decisions matter" and "No solved optimum" are met in the S02 report.

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
- 2026-10-05 · S10.3 · (this commit) · **Calibrated; both README §6 balance targets met in `latest.md`.**
  - Incumbent gauge now grows with market size: `60 + 55·log10(demand/1000)` seats, floored by range (70 / 100 / 200 / 250) and capped at 400. That's ≈100 seats on DEN–SLC, ≈130 on MAD–LIS, ≈180 on MAD–BCN.
  - No incumbent below daily service (`INCUMBENT_MIN_WEEKLY_FREQUENCY` 3 → 7), so LIH–KOA is uncontested again.
  - `INCUMBENT_FARE_SENSITIVITY` stays 1; fare cap 3×.
  - Fare sweep refined to 0.5–3× (3× is the cap).
  - Report section 0 checks the targets from the same engine runs:
    - **No solved optimum:** ✅ best fare 1.4× JFK–BOS, 1.2× MAD–BCN, 1× MAD–LIS and DEN–SLC, 0.8× LIH–KOA.
    - **Decisions matter:** ✅ CV 0.52 of profit/day across 20 MAD routes of every size, each with the better of ATR 72 / A320neo at 1× ($9k–$48k/day).
    - My first version of the metric (ATR only, the 20 biggest markets) gave CV 0.07, because every big market fills an ATR. Aircraft choice per market is what creates the spread.
  - Other results:
    - An A320 beats an ATR on big markets (MAD–BCN $21.4k vs $6.1k/day) and loses money on DEN–SLC, where the ATR wins.
    - The 2× "balanced" and 5× "greedy" strategies now lose money.
    - The cautious path still takes 55 days to Tier 2 (pacing is S12).
  - Gate: lint, typecheck, coverage, 18 e2e.
- 2026-10-05 · S10.4 · (this commit) · `computeFlightPassengers` returns the market's `incumbent` (null when uncontested) and `playersShareOfMarket`. `RouteProjection` exposes `incumbent: { frequencyPerWeek, seatsPerFlight, share }`. Its `marketShare` and `competitorShares` are now shares of the **whole** market (QSI share × what the players win from the incumbent), so ours, the rivals' and the incumbent's add up to 1. Tests: the existing share-sum test includes the incumbent; MAD–BCN has an incumbent with >100 round trips/week and >90% share, and LIH–KOA has none (100% ours). 232 store tests and the coverage gate pass.
- 2026-10-05 · S10.5 · (this commit) · Changes:
  - **Route card:** the third tile is now "Your share" (of the whole market; "<1%" / ">99%" for the extremes). A line names the incumbent ("An established airline flies this 1,515 times a week and holds >99% of the market. Win share with frequency and price.") or says the market is uncontested, plus how many other players fly it. The old rivals/noRivals/share keys were replaced. en + es.
  - **Fare editor:** each fare input gets `max` = 3× suggested and shows "Suggested: X · max Y" (the editor's strings stay English until S24).
  - 2 new card tests (incumbent line on MAD–BCN, uncontested on LIH–KOA).
  - Committed `docs/overhaul/balance/baseline-v2.md` (identical to `latest.md`), the "before" for S11/S12.
  - Screenshot taken (MAD→BCN: $2,380/day after lease, 87% LF, <1% share, launch with an ATR 72).
  - Gate: lint, typecheck, coverage, 18 e2e.

## Follow-ups

- **Long-haul widebodies are weak:** a 787-9 on JFK–LHR runs at 26% LF at 7/week because the per-leg demand is about one incumbent planeload (250 seats × 0.8) less supply pressure. Revisit the long-haul gauge floor or per-class demand when S12 tunes fleet economics.
- **Pacing (S12):** the cautious player needs 55 days to Tier 2, and nobody reaches Tier 4 within a year in the strategy sims.
- **Demand scale:** the gravity model gives MAD–BCN ~670k raw pax/week (real: ~50k). The incumbent model makes the absolute scale mostly irrelevant to players, but numbers shown in the UI (market size) will look unreal.

## Handoff notes

**Shipped:** every market big enough for daily service has an incumbent carrier at the suggested fare. Players win share from it with frequency and price (stage 1: frequency × fareRatio^-1), then split their share with QSI (stage 2, unchanged).

- Fares are capped at 3× suggested in the reducer, slice and engine.
- `pnpm balance` checks the README §6 targets, and both are met: best fare 0.8–1.6× on every market; profit spread CV 0.52.
- The overpricing exploit is gone, and aircraft choice now depends on market size (A320 on big markets, ATR on medium, uncontested thin markets).
- The route card shows the incumbent and our share of the whole market.

**For S11/S12:**

- Start from `baseline-v2.md`.
- Supply pressure still double-penalizes big aircraft on markets their size doesn't fit (A320 at 31% on MAD–LIS); that's S11's oversupply curve.
- A first ATR route nets ~$2.4k/day after lease and the cautious path needs 55 days to Tier 2: pacing is S12.

**Gotchas:**

- Tuning lives in `packages/core/src/incumbent.ts` (`INCUMBENT_*`, `incumbentSeatsPerFlight`) and `FARE_CAP_MULTIPLIER` in `finance.ts`. Change them, run `pnpm balance`, and section 0 says whether the targets still hold.
- `RouteProjection.marketShare` now means the share of the whole market (it used to be the share among players only).
