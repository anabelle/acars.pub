# S40 — Real globe + atmosphere + fly-to

> **Status:** ☐ not started · **Track:** Graphics · **Size:** M · **Depends on:** S01 · **Unblocks:** S41
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Performance check: 10k simulated aircraft at 60 fps desktop / 30 fps mid-range mobile (record numbers in the PR).
- Keep the day/night terminator working on the globe.

## Acceptance criteria

- [ ] S01 map test green; screenshots at both sizes; perf numbers recorded.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
