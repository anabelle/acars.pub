# S55 — An eventful real-time world (D5 = option C)

> **Status:** ◐ in progress
> **Next step:** S55.2
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
>
> **Track:** Growth · **Size:** M (4 steps) · **Depends on:** S31, S32, S33, S34 · **Unblocks:** — · **Decided by D5 (2026-10-07)**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

The 1:1 world feels busy from the first session: the first landing comes soon, there is always something worth reacting to, and coming back shows what happened instead of telling it. This is the owner's choice for D5 (option C in [`../tycoon-mode.md`](../tycoon-mode.md)): no second, faster mode.

## Why (evidence)

- New players in fast-mode competitors report "nothing happens" in real-time games (S53).
- A 7-hour first flight means the first payoff can land after the player has left.
- World events (S33) and daily objectives (S32) exist, but don't yet point at each other or reach the player outside the app.

## Read first

- `docs/overhaul/tycoon-mode.md` (option C and the cost estimate)
- `apps/web/src/features/network/hooks/useHubOpportunities.ts`, `RouteDecisionCard.tsx` (starter suggestions)
- `apps/web/src/features/cockpit/components/FirstHourChecklist.tsx` (S31)
- `packages/core/src/objectives.ts` (S32), `packages/core/src/worldEvents.ts` (S33)
- `apps/web/src/features/airline/components/AwayReport.tsx`, `features/airline/utils/summarizeTimeline.ts`
- `apps/web/src/features/notifications/` (S34, D3: local notifications first)

## In scope

- Starter suggestions favour short first hops (about 1–2 h), so the first landing comes in the first session.
- Event-themed daily objectives, drawn deterministically from the day's world events.
- A time-lapse: the away report can replay the hours you missed on the map at 60× (cosmetic; game time is untouched).
- A local notification when a world event touches one of the player's routes.

## Out of scope

- Any change to game speed, the clock or the economy (Rule 2).
- Nostr DM notifications (D3: later).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S55.1** Short first hops: rank starter suggestions so a new airline's top picks fly about 1–2 h; checklist copy says when the first landing will come. _Done when:_ unit tests + e2e (a new airline's first suggestion lands within 2 h).
- [ ] **S55.2** Event-themed objectives ("fly into the festival at BCN"), deterministic from `getEventsForDay`, claimable like other objectives (replay-verified, D6). _Done when:_ core tests (determinism, verification) + component test.
- [ ] **S55.3** Time-lapse replay: "Watch what happened" on the away report animates the missed flights on the map at 60×, from the timeline (no simulation). _Done when:_ component tests + e2e + screenshot.
- [ ] **S55.4** Local notification when an event starts on one of your routes (respecting notification settings). _Done when:_ unit tests + e2e with a pinned clock.

## Acceptance criteria

- [ ] A new airline lands its first flight within its first session.
- [ ] Every day has at least one thing worth reacting to, inside and outside the app.
- [ ] Coming back after hours shows what happened, not just a summary.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · brief · (S55.1 commit) · Written after the owner chose option C for D5.

2026-10-07 · S55.1 · (this commit) · **Real first suggestions, short hops first.**

- **Found:** the Opportunities tab (where the first-hour checklist sends new players) didn't choose routes. It sampled the 2 nearest airports, 2 from the middle of the distance list and the 2 farthest airports in the world. A new Madrid airline was offered 10–22 km hops losing about $2.3k/day and out-of-range routes to Shanshan or Masterton.
- **Now:**
  - It projects the 24 most populous unserved airports within the tier's range (and at least 200 km away), using `candidateDestinations`, the same picker as the S43 map layer. They are ranked by projected profit per day.
  - For an airline with no routes yet, profitable hops that land within 2 h (distance ÷ the recommended aircraft's cruise speed) go first and carry a "First landing in ~X h" badge (en/es).
  - Result: a new Madrid airline's top suggestion is MAD → ORY, +$999/day, about 1.9 h.
- **Checklist copy:** unchanged. The badge says when the first landing comes, right where the route is chosen, which covers the brief's ask.
- **Tests:** unit tests for `rankForFirstRoute` (order, profit, ties) and `flightHours`. The e2e (`first-hour.spec.ts`) checks that a new airline's top suggestion carries the badge.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
