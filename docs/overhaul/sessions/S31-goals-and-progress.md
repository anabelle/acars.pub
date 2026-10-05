# S31 — First-hour checklist + tier progress

> **Status:** ◐ in progress
> **Next step:** S31.2
> **Branch:** claude/zen-darwin-3op878
> **PR:** —
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
- [ ] **S31.2** Checklist widget in cockpit with deep links. _Done when:_ screenshots.
- [ ] **S31.3** Tier progress in top bar. _Done when:_ screenshots at both sizes.
- [ ] **S31.4** Milestone toasts + tier-up celebration (S12 data if merged). _Done when:_ screenshot/video.

## Details & guidance

- Checklist state derives from airline state, not stored flags, so it's correct on any device.
- en + es.

## Acceptance criteria

- [ ] Screenshots of each checklist step; unit tests for step derivation.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-05 · S31.1 · (this commit) · `cockpit/utils/firstHourChecklist.ts` derives the five first-hour steps from airline state only (no stored flags), so they are the same on every device. The steps: open a route (≥1 non-suspended route); first takeoff (an aircraft enroute or with a flight, or already landed); first landing (cumulative revenue > 0, or a landing in the timeline); adjust a fare (any route priced differently from `getSuggestedFares`, since `openRoute` stores the suggested fares); and a 3rd route. Each step carries a deep link: Routes › Opportunities, Fleet, or Routes › Active. Returns `next`, `doneCount` and `complete`. 6 unit tests.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
