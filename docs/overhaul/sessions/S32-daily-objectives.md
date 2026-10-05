# S32 — Deterministic daily objectives

> **Status:** ☐ not started · **Track:** Loop · **Size:** L · **Depends on:** S03, decision D6 (S12 recommended) · **Unblocks:** S51 (rewards) · **Gated by D6**
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

## Goal

Give every check-in a short-horizon goal that's the same for all players and verifiable by any client.

## Why (evidence)

- Audit §2.2/§2.3: no short-horizon goals; design bible engagement loops.

## Read first

- `packages/core/src/prng.ts`, `season.ts`
- `ruleset.ts` (S03)
- `actionReducer.ts`

## In scope

- `getDailyObjectives(utcDate, ruleset)`: pure, seeded by date; 3 objectives/day from a template table (carry N pax to a tag, open a route > X km, hit LF band on a route, …)
- Progress evaluator: pure function of the action log + engine results in the window
- `CLAIM_OBJECTIVE` action: the reducer re-verifies and applies a fixed-point reward from the ruleset
- Cockpit widget

## Out of scope

- Weekly or seasonal objectives (follow-up).

## Tasks

- Anti-abuse: claims are idempotent per (pubkey, date, objective) and invalid claims are rejected on replay.
- Tests: identical objectives across clients for the same date; claim verification; replay.

## Acceptance criteria

- [ ] Two independent replays agree on balances after claims; the widget shows progress live.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
