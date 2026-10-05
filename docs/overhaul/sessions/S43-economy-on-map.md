# S43 — Economy on the map

> **Status:** ☐ not started · **Track:** Graphics · **Size:** M · **Depends on:** S42, S23 (S33 for event pins) · **Unblocks:** —
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

## Goal

Money and opportunity are visible on the world itself.

## Why (evidence)

- Audit §2.8 and U11 (no juice).

## Read first

- S23 `projectRouteEconomics`
- landing events in the store/timeline

## In scope

- Floating `+$` labels on landings (pooled, capped count)
- Opportunity heatmap from the selected hub (projected profit/day per destination, computed in a worker, cached per hub + tick bucket)
- Event pins from S33 if merged

## Out of scope

- Sound (follow-up).

## Tasks

- Respect `prefers-reduced-motion`.
- Heatmap computation must stay off the main thread.

## Acceptance criteria

- [ ] Screenshots/video; no main-thread long tasks > 50 ms from the heatmap.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
