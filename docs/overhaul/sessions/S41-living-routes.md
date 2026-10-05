# S41 — Living routes

> **Status:** ☐ not started
> **Next step:** S41.1
> **Branch:** —
> **PR:** —
>
> **Track:** Graphics · **Size:** M (3 steps) · **Depends on:** S40 · **Unblocks:** S42
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Routes show the business: color by profit, width by frequency, motion by direction.

## Why (evidence)

- Audit §2.8: routes are static flat lines.

## Read first

- `packages/map/src/layers/*` (after S40)
- store selectors for route profit (cockpit computes strongest/weakest)

## In scope

- Data-driven line color (profit/hour → green to red), width (weekly frequency), animated dash flow
- Rival routes thinner, in their livery color; a "my network / world" toggle

## Out of scope

- 3D arcs (S45).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S41.1** Route feature properties: profit/hour, weekly frequency, owner. _Done when:_ unit tests for property builder.
- [ ] **S41.2** Color/width expressions + legend chip. _Done when:_ screenshots.
- [ ] **S41.3** Dash-flow animation + my-network/world toggle. _Done when:_ frame time within 10% of S40.

## Details & guidance

- All styling via feature properties and expressions (no per-frame JS loops over routes).
- Legend chip in the map corner.

## Acceptance criteria

- [ ] Screenshots; frame-time unchanged within 10% vs S40 numbers.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
