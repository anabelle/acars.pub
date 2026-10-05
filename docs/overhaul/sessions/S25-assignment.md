# S25 — Assign from both sides + ferry-and-assign

> **Status:** ☐ not started · **Track:** UX · **Size:** M · **Depends on:** S23 · **Unblocks:** —
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

## Goal

Put planes on routes from wherever the player is looking.

## Why (evidence)

- Ledger A8: assignment exists only in `FleetManager.tsx`.

## Read first

- `fleet/components/FleetManager.tsx`
- `RouteManager.tsx` active routes
- `network/components/AircraftInfoPanel.tsx`
- `fleetSlice.ferryAircraft`, `networkSlice.assignAircraftToRoute`

## In scope

- "Add aircraft" on route rows/panels; "Assign route" on aircraft panels
- Candidate list filtered to aircraft at a valid endpoint, with "ferry + assign" for others (two actions, one confirm)

## Out of scope

- Changing assignment rules.

## Tasks

- Reuse the S23 hook's orchestration for multi-action flows.
- en + es.

## Acceptance criteria

- [ ] Assignment possible from route panel, aircraft panel and fleet list; e2e test.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
