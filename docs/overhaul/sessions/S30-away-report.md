# S30 — "While you were away" report

> **Status:** ☑ ready for review
> **Next step:** — (all steps done; awaiting review)
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
- [x] **S30.2** Last-seen tracking (safe storage) + report modal. _Done when:_ screenshot after simulated 12 h.
- [x] **S30.3** Toast-burst suppression + deep links + i18n. _Done when:_ screenshots.

## Details & guidance

- Contents: flights flown, passengers, revenue, profit, best and worst route, groundings, tier progress delta, competitor entries on your routes (if available), each with a deep link.
- Suppress the per-event toast burst during catch-up when the report shows.
- en + es.

## Acceptance criteria

- [x] Unit tests for the summarizer; screenshot of the report after a simulated 12 h absence.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

- 2026-10-05 · S30.1 · (this commit) · `apps/web/src/features/airline/utils/summarizeTimeline.ts`: pure `summarizeTimeline(events, fromTick, toTick)`, a single pass over the timeline with fixed-point money. The window is `(fromTick, toTick]`. It reports flights (landings), passengers, revenue, costs (flight costs plus lease payments), profit, lease payments, best and worst route (each route aggregated across both directions by routeId; worst only when 2+ routes flew), grounded aircraft (engine id prefix `evt-grounded-`, de-duplicated per aircraft), deliveries, new tier (from `evt-tier-up-{tier}-`), price-war routes and bankruptcy. **Gotcha:** the store caps the timeline at 1000 events, which a long absence with a big fleet can exceed. The summary returns `complete: false` and `coveredFromTick` when the cap may have dropped the start of the window, so the report can say "since HH:MM" instead of overstating. Competitor entries aren't in the timeline (no event type), so they're out of scope per the brief. 7 tests.
- 2026-10-05 · S30.2 · (this commit) · How it works:
  - **Last-seen** (`features/airline/lib/lastSeen.ts`) is the last tick the player saw _simulated_ (`airline.lastTick`), stored per pubkey in localStorage with every access in try/catch.
  - **`useAwayReport`** works through store subscriptions (no re-render on every tick). It decides only once the simulation is within 1 min of the wall clock and catch-up has finished, then reports if the absence is 1 h or more. The window is last-seen → now, summarized by `summarizeTimeline`.
  - Last-seen is written on a 30 s heartbeat while visible, on `visibilitychange` to hidden, and on `pagehide`. It's **never written while the simulation lags the clock**, which handles a device that sleeps with the tab visible (no visibilitychange).
  - A returning background tab gets a report too.
  - **`AwayReport`** is a root-mounted dialog: a bottom sheet on phones, a centered card on desktop. It shows profit (green or red) with revenue/costs, flights, passengers, best and weakest route, promotion, deliveries, groundings, price wars, bankruptcy, a "quiet" variant with no flights, and a note when the 1000-event timeline cap cut the window. Escape, the close button and "Back to my airline" dismiss it. en + es.
  - Tests: decision rules, storage round-trip, garbage and blocked storage; dialog rendering, quiet and partial variants, closing.
  - **`e2e/away-report.spec.ts`**: Playwright's clock with a new airline, MAD→BCN launched, then `fastForward("12:00:00")`. The engine really simulates the 12 h. The report showed 9 flights, 378 passengers and +$12,940 on MAD ⇄ BCN plus "1 aircraft delivered" (screenshots taken on desktop and phone). Gate: lint, typecheck, 255 web unit tests, 17 e2e.
- 2026-10-05 · S30.3 · (this commit) · Changes:
  - **Toast-burst suppression:** `shared/lib/catchupBatch.ts#isCatchupBatch`. The toast bridge now skips any timeline update whose simulation jump (`airline.lastTick` before and after, which change in the same `set`) is 1 h or more, or that comes from loading the airline. Before, only jumps above the engine's 2000-tick catch-up UI were muted, so a 1–1.7 h absence replayed 5 stale toasts and a fresh load toasted yesterday's last event. Live toasts resume right after. The bridge test fails without the change (mutation-checked).
  - **Deep links:** best and weakest route → `/airport/{destination}` (the panel with the hub route); grounded aircraft → `/aircraft/{id}`; price-war routes → `/airport/{destination}`; "Full activity log" → `/corporate?section=activity`. Every link closes the report.
  - The report moved from `main.tsx` into the root layout so its links have the router; it renders through a portal, so placement doesn't matter. en + es keys at parity.
  - The e2e now also checks that no toasts show after the 12 h jump, and that the best-route link lands on `/airport/BCN` with the report closed.
  - Gate: lint, typecheck, 260 web unit tests, 17 e2e.

## Follow-ups

- **Projection vs engine frequency (S24):** for MAD→BCN with one ATR 42, the S23 card projected ~6 flights/day, but the engine flew 9 legs in 12 h (~18/day). The engine flies as fast as turnarounds allow, while `projectRouteEconomics` assumes the stored 7/week frequency. The per-day profit headline is therefore likely understated. Align the projection with the engine's real cadence.
- **i18n parity test:** nothing fails when an es key is missing (checked by hand for `awayReport` and `routeCard`). A test that diffs en/es key sets per namespace would catch drift.

## Handoff notes

**Shipped:** after an absence of an hour or more (reload, background tab, or a sleeping device), the player gets a report of what their airline did: profit, revenue and costs, flights, passengers, best and weakest route, promotions, deliveries, groundings, price wars and bankruptcy. Each item deep-links to the relevant page, and the catch-up no longer fires a burst of stale toasts. Verified with a real simulated 12 h absence in the browser.

- `summarizeTimeline` (pure, O(events)) is reusable for a daily digest or a share card (S46/S47).
- Last-seen is per device (localStorage). A player who switches devices sees the report for the time since their last visit _on that device_. A Nostr-synced last-seen would be more correct, but it means publishing an event on every visit; left out on purpose.

**Not done / gotchas:**

- Competitor entries on your routes aren't reported: the timeline has no event for them (out of scope: no new engine events).
- The timeline keeps 1000 events, so a very long absence with a big fleet is only partly covered. The report says so (`complete: false`).
- A fresh airline (no last-seen yet) never gets a report. The first one comes after the second visit.
