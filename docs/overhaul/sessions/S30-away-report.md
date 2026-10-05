# S30 — "While you were away" report

> **Status:** ☐ not started
> **Next step:** S30.1
> **Branch:** —
> **PR:** —
>
> **Track:** Loop · **Size:** M (3 steps) · **Depends on:** — · **Unblocks:** —
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

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

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S30.1** `summarizeTimeline` + tests. _Done when:_ tests green.
- [ ] **S30.2** Last-seen tracking (safe storage) + report modal. _Done when:_ screenshot after simulated 12 h.
- [ ] **S30.3** Toast-burst suppression + deep links + i18n. _Done when:_ screenshots.

## Details & guidance

- Contents: flights flown, passengers, revenue, profit, best and worst route, groundings, tier progress delta, competitor entries on your routes (if available), each with a deep link.
- Suppress the per-event toast burst during catch-up when the report shows.
- en + es.

## Acceptance criteria

- [ ] Unit tests for the summarizer; screenshot of the report after a simulated 12 h absence.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
