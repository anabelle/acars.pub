# S03 — Ruleset versioning by activation tick

> **Status:** ☐ not started
> **Next step:** S03.1
> **Branch:** —
> **PR:** —
>
> **Track:** Foundations · **Size:** L (5 steps) · **Depends on:** S02, decision D2 · **Unblocks:** S10, S11, S12, S13, S32, S33 · **Gated by D2**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

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

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S03.1** Constant inventory + `ruleset.ts` with `RULESET_V1`, `getRuleset` + unit tests (not wired yet). _Done when:_ tests green.
- [ ] **S03.2** Wire core functions (`demand`, `qsi`, `finance`, `tier`) to take a ruleset (default V1). _Done when:_ S02 report byte-identical.
- [ ] **S03.3** Wire store call sites (`FlightEngine`, `engineSlice`, `actionReducer`, slices) by tick. _Done when:_ S02 report byte-identical; all tests green.
- [ ] **S03.4** Boundary determinism tests (`RULESET_TEST` at tick T) + checkpoint replay across T. _Done when:_ new tests green.
- [ ] **S03.5** Docs: "Changing the rules" in `ECONOMIC_MODEL.md`. _Done when:_ doc merged.

## Details & guidance

- Inventory every tunable constant used by the engine, reducer and tier logic; list them in the PR.
- Replace direct constant use with `getRuleset(tick).<field>`, keeping it O(1) (a sorted table lookup, cached per tick range).
- Determinism tests: (a) the S02 harness output is unchanged; (b) a synthetic `RULESET_TEST` activated at tick T changes outputs **only** for ticks ≥ T; (c) checkpoint replay across T matches a straight replay.
- Document how to add a ruleset in `docs/ECONOMIC_MODEL.md` ("Changing the rules").

## Acceptance criteria

- [ ] All existing tests pass unchanged; S02 report is identical; new boundary tests pass.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
