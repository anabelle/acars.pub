# S53 — Fast "Tycoon" sandbox: design doc

> **Status:** ☐ not started
> **Next step:** S53.1
> **Branch:** —
> **PR:** —
>
> **Track:** Growth · **Size:** S (2 steps) · **Depends on:** S04 (data), decision D5 · **Unblocks:** — · **Gated by D5**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Decide whether, and how, to offer a non-ranked accelerated world for first sessions, without compromising the 1:1 ranked world.

## Why (evidence)

- Competitors pair a real-time mode with a fast mode (Airlines Manager PRO/TYCOON); new players report "nothing happens".

## Read first

- `AGENTS.md` Rule 2
- S04 funnel report
- S26 sandbox implementation if merged

## In scope

- `docs/overhaul/tycoon-mode.md`: goals, time multiplier, isolation from ranked state (separate event kind or tag), progression carry-over policy (recommended: none), cost estimate

## Out of scope

- Implementation.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S53.1** Options doc with 2–3 designs. _Done when:_ doc committed.
- [ ] **S53.2** Recommendation + cost estimate. _Done when:_ owner can decide D5.

## Details & guidance

- Present 2–3 options with trade-offs and a recommendation.

## Acceptance criteria

- [ ] The owner can make decision D5 from the doc alone.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
