# S31 — First-hour checklist + tier progress

> **Status:** ☑ merged
> **Next step:** — (merged in #169)
> **Branch:** claude/zen-darwin-3op878
> **PR:** https://github.com/anabelle/acars.pub/pull/169
>
> **Track:** Loop · **Size:** M (4 steps) · **Depends on:** S22 (S12 for milestone data, optional) · **Unblocks:** —
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Always show the next goal: a guided first hour, then tier progress and milestones.

## Why (evidence)

- Audit §2.3/§2.4: no goals on screen; T-091 deferred; tier progress only in `/corporate`.

## Read first

- `cockpit/components/OperationsCockpit.tsx`
- `layout/Topbar.tsx`
- `packages/core/src/tier.ts`
- `routes/-corporate.lazy.tsx` (existing tier UI)

## In scope

- Checklist (open first route → first takeoff → first landing → adjust a fare → 3rd route) derived from state, each step deep-linked
- Compact tier progress in the top bar (revenue % and routes %)
- Milestone toasts and a celebration moment on tier-up (consumes S12 `MILESTONES` if merged; otherwise tiers only)

## Out of scope

- Changing thresholds (S12).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S31.1** Checklist step derivation from state + tests. _Done when:_ tests green.
- [x] **S31.2** Checklist widget in cockpit with deep links. _Done when:_ screenshots.
- [x] **S31.3** Tier progress in top bar. _Done when:_ screenshots at both sizes.
- [x] **S31.4** Milestone toasts + tier-up celebration (S12 data if merged). _Done when:_ screenshot/video.

## Details & guidance

- Checklist state derives from airline state, not stored flags, so it's correct on any device.
- en + es.

## Acceptance criteria

- [x] Screenshots of each checklist step (`e2e/first-hour.spec.ts`, local captures); unit tests for step derivation.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-05 · S31.1 · (this commit) · `cockpit/utils/firstHourChecklist.ts` derives the five first-hour steps from airline state only (no stored flags), so they are the same on every device. The steps: open a route (≥1 non-suspended route); first takeoff (an aircraft enroute or with a flight, or already landed); first landing (cumulative revenue > 0, or a landing in the timeline); adjust a fare (any route priced differently from `getSuggestedFares`, since `openRoute` stores the suggested fares); and a 3rd route. Each step carries a deep link: Routes › Opportunities, Fleet, or Routes › Active. Returns `next`, `doneCount` and `complete`. 6 unit tests.
2026-10-05 · S31.2 · (this commit) · `cockpit/components/FirstHourChecklist.tsx` sits at the top of the cockpit for your own airline (not when viewing a rival) until all five steps are done. It shows an `n of 5` badge and progress bar, ticks completed steps, and highlights the next step with a hint and a deep link (Find a route, Open fleet, Watch your routes, Edit fares, Find routes). The derivation gained `waiting`: when an aircraft is assigned but not yet flying (the airport-panel launch assigns one that waits for delivery), the takeoff step says so instead of asking you to assign one. Strings are en + es. Tests: widget unit tests (next-step link, progress, hidden when complete) and `e2e/first-hour.spec.ts`, which goes 0/5 → link to Opportunities → launch MAD-BCN → open route ticked, with the takeoff step waiting. Screenshots are in that spec (`test-results/checklist-*.png`).
2026-10-05 · S31.3 · (this commit) · New core helper `getTierProgress(tier, cumulativeRevenue, activeRoutes)`: per-requirement % toward the next tier (capped), met flags and targets; null `nextTier` at the top tier. Pure, 3 core tests. The top bar's "Brand / Tier" cell is now two cells: Brand (score) and Tier. Tier shows "T1 → 2" with two mini bars (Rev %, Routes %, green when met) and a tooltip with the exact targets ("Tier 2 needs $5,000,000 in total revenue and 3 active routes."); at the top tier it reads "T4 · top tier". The bars stack vertically on phones. Primitive store selectors (tier, revenue, active-route count). Checked by screenshot at 1440 and in the 390 mobile drawer. Topbar test mocks gained `routes`; `topbar.brandTier` was replaced by `brand`/`tierProgress` (en + es). The Finance page still computes its own tier progress; it could reuse the helper later.
2026-10-05 · S31.4 · (this commit) · `airline/components/MilestoneCelebrations.tsx`, mounted in `__root`, subscribes to the airline store outside render, so the root never re-renders. Live changes only: when a first-hour checklist step becomes done it toasts "Milestone reached" with the step; when `airline.tier` rises it opens a celebration dialog ("Tier 2 reached!") with what it unlocks (route range and max hubs from core), the next tier's targets and "Keep flying". Escape or the close button dismiss it, and focus moves to close. Quiet on airline load, on switching airlines, during catch-up and on a ≥1h catch-up batch (the away report covers those). S12 isn't merged, so it covers tiers only. 4 unit tests against the real store. Screenshot taken by driving a tier-up through the Vite dev server's store module. A tier-up can't be reached in e2e without S12 or a test hook.

## Follow-ups

- When S12 lands, feed its `MILESTONES` into `MilestoneCelebrations` (same toast path).
- `-corporate.lazy.tsx` duplicates the tier-progress math; switch it to `getTierProgress`.
- The mobile guest/home card still says "Let the simulation breathe first… Open operator cockpit" (jargon, S22 missed it).

## Handoff notes

- **Shipped:**
  - A first-hour checklist derived from state, in the cockpit with deep links and a "waiting" state for an assigned aircraft.
  - Tier progress in the top bar (core `getTierProgress`).
  - Milestone toasts and a tier-up celebration.
- **Gotchas:**
  - "Adjusted a fare" is derived from fares differing from `getSuggestedFares`. Choosing the Suggested preset again therefore un-ticks it, which is acceptable.
  - The celebrations subscribe with a baseline per airline id, so loading or switching airlines never replays milestones.
- **Not done:**
  - S12 milestone data, once S12 merges.
  - The Finance page still duplicates the tier-progress math.
