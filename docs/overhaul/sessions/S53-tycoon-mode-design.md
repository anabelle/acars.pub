# S53 — Fast "Tycoon" sandbox: design doc

> **Status:** ◐ in progress
> **Next step:** S53.2
> **Branch:** `claude/zen-darwin-3op878`
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

- [x] **S53.1** Options doc with 2–3 designs. _Done when:_ doc committed.
- [ ] **S53.2** Recommendation + cost estimate. _Done when:_ owner can decide D5.

## Details & guidance

- Present 2–3 options with trade-offs and a recommendation.

## Acceptance criteria

- [ ] The owner can make decision D5 from the doc alone.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · S53.1 · (this commit) · **Options doc: `docs/overhaul/tycoon-mode.md`.**

- **Constraints:** the ranked world stays 1:1 and untouched, determinism, no carry-over, one engine.
- **What exists:**
  - Worlds are already namespaced by `WORLD_ID` (the `world` tag and `d`-tag prefix), so a fast world is isolated by construction.
  - Everything game-side is in ticks, so a faster clock speeds the economy up uniformly.
  - The 1:1 assumption lives in 22 files using `TICK_DURATION` and 15 using `GENESIS_TIME`. That is the main cost of any fast mode.
- **Options:** A, a separate 24× multiplayer world with monthly seasons; B, a local 60× practice run that publishes nothing (S26's option-A sandbox); C, no second mode, with a time-lapse replay, shorter first loops and more act-now moments in the 1:1 world.
- **Evidence:** the funnel has almost no players yet, so there is no D7 retention figure to show pacing is the problem.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
