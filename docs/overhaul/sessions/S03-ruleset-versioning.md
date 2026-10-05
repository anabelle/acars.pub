# S03 — Ruleset versioning by activation tick

> **Status:** ☐ not started · **Track:** Foundations · **Size:** L · **Depends on:** S02, decision D2 · **Unblocks:** S10, S11, S12, S13, S32, S33 · **Gated by D2**
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

## Goal

Let economic rules change **without** altering replay of past ticks: `getRuleset(tick)` returns the constants and strategy functions active at that tick.

## Why (evidence)

- Every economy fix changes engine outputs. Without versioning, old action logs replay differently and checkpoints desync (Rule 4, determinism note in the audit §3).

## Read first

- `packages/core/src/demand.ts`, `qsi.ts`, `finance.ts`, `tier.ts`
- `packages/store/src/FlightEngine.ts`, `slices/engineSlice.ts`, `actionReducer.ts`, `checkpoint` code
- `docs/SCALABILITY.md`

## In scope

- New `packages/core/src/ruleset.ts`: `Ruleset` type, `RULESET_V1` (current constants verbatim), `RULESETS` table `[ {fromTick, ruleset} ]`, `getRuleset(tick)`
- Thread the ruleset through engine call sites (constants like `PLAYER_MARKET_CEILING`, `NATURAL_LF_CEILING`, elasticities, `MAX_FARE`, `ROUTE_SLOT_FEE`, tier thresholds, brand deltas)

## Out of scope

- Any **value** change. V1 must be byte-for-byte identical in behavior.

## Tasks

- Inventory every tunable constant used by the engine, reducer and tier logic; list them in the PR.
- Replace direct constant use with `getRuleset(tick).<field>`, keeping it O(1) (a sorted table lookup, cached per tick range).
- Determinism tests: (a) the S02 harness output is unchanged; (b) a synthetic `RULESET_TEST` activated at tick T changes outputs **only** for ticks ≥ T; (c) checkpoint replay across T matches a straight replay.
- Document how to add a ruleset in `docs/ECONOMIC_MODEL.md` ("Changing the rules").

## Acceptance criteria

- [ ] All existing tests pass unchanged; S02 report is identical; new boundary tests pass.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
