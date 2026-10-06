# S41 — Living routes

> **Status:** ◐ in progress
> **Next step:** S41.2
> **Branch:** claude/zen-darwin-3op878
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

- [x] **S41.1** Route feature properties: profit/hour, weekly frequency, owner. _Done when:_ unit tests for property builder.
- [ ] **S41.2** Color/width expressions + legend chip. _Done when:_ screenshots.
- [ ] **S41.3** Dash-flow animation + my-network/world toggle. _Done when:_ frame time within 10% of S40.

## Details & guidance

- All styling via feature properties and expressions (no per-frame JS loops over routes).
- Legend chip in the map corner.

## Acceptance criteria

- [ ] Screenshots; frame-time unchanged within 10% vs S40 numbers.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S41.1 · (this commit) · New `packages/map/src/routeFeatures.ts`, exported from the package. `MapRoute` describes what the map draws per route: owner, `isPlayer`, `frequencyPerWeek`, `profitPerHour` (null until flown) and the rival's livery `color`. `routeFeatureProperties` derives `profitScore` (−1…+1), profit normalised against the player's largest |profit|, so the colour ramp works at any airline size; unknown profit stays null. Frequency defaults to 7 and is at least 1. `buildRouteFeatures` makes one origin→destination arc per route, so a dash animation flows in the direction of travel. It splits at the antimeridian, skips unknown airports and takes a culling predicate plus the caller's arc cache. Context: today the globe draws the player's lines per aircraft in flight (`arcs`), not per route, and gets no player routes; S41.2 switches to route features. 6 tests, 100% coverage.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
