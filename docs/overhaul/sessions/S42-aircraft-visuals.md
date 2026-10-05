# S42 — Aircraft family icons + livery tint

> **Status:** ☐ not started
> **Next step:** S42.1
> **Branch:** —
> **PR:** —
>
> **Track:** Graphics · **Size:** M (3 steps) · **Depends on:** S41 · **Unblocks:** S43
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

You can tell a turboprop from a widebody, and your fleet from a rival's, at a glance.

## Why (evidence)

- Audit §2.8: one generic icon for every aircraft.

## Read first

- `packages/map/src/icons.ts`
- `shared/components/FamilySilhouette.tsx`
- `packages/data/src/aircraft.ts` (families)

## In scope

- Icon set per family (turboprop, regional jet, narrowbody, widebody, very-large) as SDF icons for runtime tinting
- Tint with the airline's livery primary; short trail behind moving aircraft; interpolation between ticks

## Out of scope

- 3D models (S45).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S42.1** SDF icon set per aircraft family. _Done when:_ icons render at 3 zooms.
- [ ] **S42.2** Icon-image expression + livery tint. _Done when:_ screenshots.
- [ ] **S42.3** Trails + interpolation. _Done when:_ perf within 10% of S41.

## Details & guidance

- Keep a single symbol layer with an icon-image expression (instancing-friendly).
- Accessibility: shape differs by family, not only color.

## Acceptance criteria

- [ ] Screenshots at 3 zoom levels; perf within 10% of S41.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
