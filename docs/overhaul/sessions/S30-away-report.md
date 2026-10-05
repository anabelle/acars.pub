# S30 — "While you were away" report

> **Status:** ◐ in progress
> **Next step:** S30.2
> **Branch:** claude/zen-darwin-3op878
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

- [x] **S30.1** `summarizeTimeline` + tests. _Done when:_ tests green.
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

- 2026-10-05 · S30.1 · (this commit) · `apps/web/src/features/airline/utils/summarizeTimeline.ts`: pure `summarizeTimeline(events, fromTick, toTick)`, a single pass over the timeline with fixed-point money. The window is `(fromTick, toTick]`. It reports flights (landings), passengers, revenue, costs (flight costs plus lease payments), profit, lease payments, best and worst route (each route aggregated across both directions by routeId; worst only when 2+ routes flew), grounded aircraft (engine id prefix `evt-grounded-`, de-duplicated per aircraft), deliveries, new tier (from `evt-tier-up-{tier}-`), price-war routes and bankruptcy. **Gotcha:** the store caps the timeline at 1000 events, which a long absence with a big fleet can exceed. The summary returns `complete: false` and `coveredFromTick` when the cap may have dropped the start of the window, so the report can say "since HH:MM" instead of overstating. Competitor entries aren't in the timeline (no event type), so they're out of scope per the brief. 7 tests.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
