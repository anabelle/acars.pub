# S42 — Aircraft family icons + livery tint

> **Status:** ☐ not started · **Track:** Graphics · **Size:** M · **Depends on:** S41 · **Unblocks:** S43
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Keep a single symbol layer with an icon-image expression (instancing-friendly).
- Accessibility: shape differs by family, not only color.

## Acceptance criteria

- [ ] Screenshots at 3 zoom levels; perf within 10% of S41.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
