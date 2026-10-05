# S10 — Market model v2: incumbent carriers + distance-scaled fare cap

> **Status:** ☐ not started
> **Next step:** S10.1
> **Branch:** —
> **PR:** —
>
> **Track:** Economy · **Size:** L (5 steps) · **Depends on:** S03, decision D1 · **Unblocks:** S11 · **Gated by D1**
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

- `RULESET_V2` in `ruleset.ts`
- A pure `getIncumbentOffer(route, demand, ruleset)` in core: an NPC `FlightOffer` at the suggested fare, with frequency scaled to market size, travel time from distance, and fixed service/brand scores
- Include it in the offers passed to `allocatePassengers` (one extra offer, still O(1))
- Fare ceiling = `k × suggested` per class (in the ruleset), enforced in reducer and slice

## Out of scope

- Brand and oversupply changes (S11).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S10.1** `getIncumbentOffer` pure function + unit tests (not wired). _Done when:_ tests green.
- [ ] **S10.2** `RULESET_V2` fields (incumbent params, fare-cap multiplier) wired behind a placeholder far-future activation tick. _Done when:_ pre-activation replay unchanged; boundary tests green.
- [ ] **S10.3** Calibrate with S02; commit before/after report. _Done when:_ README §6 balance targets met in the report.
- [ ] **S10.4** Selector exposing incumbent strength / projected share for UI. _Done when:_ unit tests green.
- [ ] **S10.5** Propose the real activation tick in the PR for owner confirmation. _Done when:_ owner confirmed.

## Details & guidance

- Calibrate with S02 so that:
  - the profit-maximizing fare is 0.8–1.6× suggested on every market;
  - a single ATR on a big market gets a realistic share (LF 60–85% at suggested fares);
  - thin markets reach a high share with lower absolute volume.
- Expose the incumbent in UI data so S23/S24 can show "incumbent strength".
- Activation tick: choose one in the future and note it in the PR so the owner can confirm before merge.
- Before/after S02 tables in the PR.

## Acceptance criteria

- [ ] The metrics in README §6 "Decisions matter" and "No solved optimum" are met in the S02 report.
- [ ] Replay of pre-activation ticks is unchanged.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
