# S10 — Market model v2: incumbent carriers + distance-scaled fare cap

> **Status:** ☐ not started · **Track:** Economy · **Size:** L · **Depends on:** S03, decision D1 · **Unblocks:** S11 · **Gated by D1**
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

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

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
