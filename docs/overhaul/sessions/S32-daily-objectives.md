# S32 — Deterministic daily objectives

> **Status:** ☐ not started
> **Next step:** S32.1
> **Branch:** —
> **PR:** —
>
> **Track:** Loop · **Size:** L (4 steps) · **Depends on:** decision D6 (S12 recommended) · **Unblocks:** S51 (rewards) · **Gated by D6**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Give every check-in a short-horizon goal that's the same for all players and verifiable by any client.

## Why (evidence)

- Audit §2.2/§2.3: no short-horizon goals; design bible engagement loops.

## Read first

- `packages/core/src/prng.ts`, `season.ts`
- `actionReducer.ts`

## In scope

- `getDailyObjectives(utcDate, ruleset)`: pure, seeded by date; 3 objectives/day from a template table (carry N pax to a tag, open a route > X km, hit LF band on a route, …)
- Progress evaluator: pure function of the action log + engine results in the window
- `CLAIM_OBJECTIVE` action: the reducer re-verifies and applies a fixed-point reward from the ruleset
- Cockpit widget

## Out of scope

- Weekly or seasonal objectives (follow-up).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S32.1** Objective templates + `getDailyObjectives(date)` + determinism tests. _Done when:_ same objectives across clients.
- [ ] **S32.2** Progress evaluator over action log + engine results. _Done when:_ tests green.
- [ ] **S32.3** `CLAIM_OBJECTIVE` action + reducer verification + replay tests. _Done when:_ invalid claims rejected on replay.
- [ ] **S32.4** Cockpit objectives widget (en + es). _Done when:_ screenshots.

## Details & guidance

- Anti-abuse: claims are idempotent per (pubkey, date, objective) and invalid claims are rejected on replay.
- Tests: identical objectives across clients for the same date; claim verification; replay.

## Acceptance criteria

- [ ] Two independent replays agree on balances after claims; the widget shows progress live.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
