# S11 — Oversupply curve + brand score v2

> **Status:** ☐ not started
> **Next step:** S11.1
> **Branch:** —
> **PR:** —
>
> **Track:** Economy · **Size:** M (3 steps) · **Depends on:** S10 · **Unblocks:** S12
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Over-assigning aircraft degrades smoothly, and brand rewards good service rather than full planes at any price.

## Why (evidence)

- Ledger A3 (double penalty: 14% vs ~24%) and A6 (brand rises with LF > 0.85, rewarding gouging).

## Read first

- `demand.ts` `calculateSupplyPressure`
- `FlightEngine.ts` per-flight pax formula
- `engineSlice.ts` brand update

## In scope

- Ruleset fields for the pressure curve and brand inputs (V2 or V3)

## Out of scope

- Market model (S10).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S11.1** Single-application oversupply curve (ruleset) + tests. _Done when:_ monotone curve test green.
- [ ] **S11.2** Brand v2 inputs (fair-price band, condition, healthy LF band) + tests. _Done when:_ tests green.
- [ ] **S11.3** S02 over-assignment curve + brand trajectories; commit report. _Done when:_ greedy loses brand, balanced gains.

## Details & guidance

- Apply oversupply once (either frequency division or pressure), so LF tracks seats/demand with a soft floor.
- Brand inputs: fare vs market (fair-price band), maintenance state/condition, and LF only within a healthy band (60–90%).
- S02: add an over-assignment curve chart (1–20 planes) and a brand trajectory for greedy vs balanced strategies.

## Acceptance criteria

- [ ] The over-assignment curve is monotone and smooth.
- [ ] The greedy strategy loses brand over 30 simulated days; balanced gains it.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
