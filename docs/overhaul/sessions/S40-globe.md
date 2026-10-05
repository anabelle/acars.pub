# S40 — Real globe + atmosphere + fly-to

> **Status:** ☐ not started
> **Next step:** S40.1
> **Branch:** —
> **PR:** —
>
> **Track:** Graphics · **Size:** M (4 steps) · **Depends on:** S01 · **Unblocks:** S41
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

The world is a globe: atmosphere at low zoom, Mercator up close, and a "from space to your hub" moment.

## Why (evidence)

- Ledger A13: flat Mercator despite "globe" everywhere.

## Read first

- `packages/map/src/Globe.tsx` (~1,780 lines)
- MapLibre ≥ 5 globe projection and sky docs
- `docs/UI_ARCHITECTURE.md`

## In scope

- First, split `Globe.tsx` into `layers/*` modules with no behavior change (so S41–S43 can work in smaller files)
- Globe projection + sky/atmosphere + fog horizon
- Fly-to on hub selection and in onboarding

## Out of scope

- Route and aircraft styling (S41/S42).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S40.1** Split `Globe.tsx` into `layers/*` modules (no behavior change). _Done when:_ S01 map spec green.
- [ ] **S40.2** Globe projection + sky/atmosphere + terminator on globe. _Done when:_ screenshots.
- [ ] **S40.3** Fly-to on hub selection / onboarding. _Done when:_ screen recording.
- [ ] **S40.4** Perf numbers (10k aircraft) recorded in PR. _Done when:_ numbers recorded.

## Details & guidance

- Performance check: 10k simulated aircraft at 60 fps desktop / 30 fps mid-range mobile (record numbers in the PR).
- Keep the day/night terminator working on the globe.

## Acceptance criteria

- [ ] S01 map test green; screenshots at both sizes; perf numbers recorded.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
