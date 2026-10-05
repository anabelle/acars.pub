# S30 — "While you were away" report

> **Status:** ☐ not started · **Track:** Loop · **Size:** M · **Depends on:** — · **Unblocks:** —
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

## Goal

Opening the app after an absence immediately tells the story of what happened.

## Why (evidence)

- Ledger A19.

## Read first

- `feedback/TimelineToastBridge.tsx`
- `airline/components/Timeline.tsx`
- engine catch-up in `engineSlice.ts` / `reconcileFleetToTick`

## In scope

- `AwayReport` modal/drawer shown when last-seen > 1 h (last-seen kept in localStorage, wrapped in try/catch)
- Pure `summarizeTimeline(events, fromTick, toTick)` (O(events in range))

## Out of scope

- New engine events.

## Tasks

- Contents: flights flown, passengers, revenue, profit, best and worst route, groundings, tier progress delta, competitor entries on your routes (if available), each with a deep link.
- Suppress the per-event toast burst during catch-up when the report shows.
- en + es.

## Acceptance criteria

- [ ] Unit tests for the summarizer; screenshot of the report after a simulated 12 h absence.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
