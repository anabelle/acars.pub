# S11 — Oversupply curve + brand score v2

> **Status:** ☐ not started · **Track:** Economy · **Size:** M · **Depends on:** S10 · **Unblocks:** S12
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Apply oversupply once (either frequency division or pressure), so LF tracks seats/demand with a soft floor.
- Brand inputs: fare vs market (fair-price band), maintenance state/condition, and LF only within a healthy band (60–90%).
- S02: add an over-assignment curve chart (1–20 planes) and a brand trajectory for greedy vs balanced strategies.

## Acceptance criteria

- [ ] The over-assignment curve is monotone and smooth.
- [ ] The greedy strategy loses brand over 30 simulated days; balanced gains it.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
