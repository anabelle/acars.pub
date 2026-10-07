# S55 — An eventful real-time world (D5 = option C)

> **Status:** ☑ merged
> **Next step:** —
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** — (merged in #190)
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
- [x] **S55.2** Event-themed objectives ("fly into the festival at BCN"), deterministic from `getEventsForDay`, claimable like other objectives (replay-verified, D6). _Done when:_ core tests (determinism, verification) + component test.
- [x] **S55.3** Time-lapse replay: "Watch what happened" on the away report animates the missed flights on the map at 60×, from the timeline (no simulation). _Done when:_ component tests + e2e + screenshot.
- [x] **S55.4** Local notification when an event starts on one of your routes (respecting notification settings). _Done when:_ unit tests + e2e with a pinned clock.

## Acceptance criteria

- [ ] A new airline lands its first flight within its first session.
- [ ] Every day has at least one thing worth reacting to, inside and outside the app.
- [ ] Coming back after hours shows what happened, not just a summary.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · brief · (S55.1 commit) · Written after the owner chose option C for D5.

2026-10-07 · S55.1 · 8e2968f · **Real first suggestions, short hops first.**

- **Found:** the Opportunities tab (where the first-hour checklist sends new players) didn't choose routes. It sampled the 2 nearest airports, 2 from the middle of the distance list and the 2 farthest airports in the world. A new Madrid airline was offered 10–22 km hops losing about $2.3k/day and out-of-range routes to Shanshan or Masterton.
- **Now:**
  - It projects the 24 most populous unserved airports within the tier's range (and at least 200 km away), using `candidateDestinations`, the same picker as the S43 map layer. They are ranked by projected profit per day.
  - For an airline with no routes yet, profitable hops that land within 2 h (distance ÷ the recommended aircraft's cruise speed) go first and carry a "First landing in ~X h" badge (en/es).
  - Result: a new Madrid airline's top suggestion is MAD → ORY, +$999/day, about 1.9 h.
- **Checklist copy:** unchanged. The badge says when the first landing comes, right where the route is chosen, which covers the brief's ask.
- **Tests:** unit tests for `rankForFirstRoute` (order, profit, ties) and `flightHours`. The e2e (`first-hour.spec.ts`) checks that a new airline's top suggestion carries the badge.

2026-10-07 · S55.2 · 2572f27 · **Event-themed daily objectives.**

- **Core:** `eventObjectiveForDate(date)` picks that UTC day's first-starting airport event that lifts demand (festival, sports final), scanning `getEventsForDay` from 4 engine days before (so events already running count). Ties go to the lower id. It becomes a fourth objective, `routeToEvent`, appended after the three template draws, so the existing objectives and their ids don't change. Reward: $150k (`EVENT_OBJECTIVE_REWARD`).
- **Progress:** a route opened that day with the event's airport at either end. Days without such an event (34 of 365 in 2026) keep the three objectives.
- **Claims:** same path as the others. `verifyObjectiveClaim` rebuilds the day's objectives, so the replay check (D6) covers it with no store change.
- **UI:** "Festival at BCN: open a route there" (en/es), reusing the world-event kind names.
- **Tests:** core (pinned 2026-10-07 → festival at BCN, null on 2026-01-03, either-end evaluation, claim accepted/incomplete) and the card (title, completes on a route to BCN, Spanish).

2026-10-07 · S55.3 · 5fd26b8 · **Time-lapse of the absence.**

- **Away report:** a "Watch what happened (N flights)" button, shown when at least one landing in the window can be replayed. It closes the report and plays the replay on the main map.
- **From the timeline, no simulation:** each landing event carries its flight duration, so a leg is (landing tick − duration → landing tick). `buildTimeLapse` spans the first departure (or the start of the absence) to the last landing. Cosmetic only: game time and state are untouched (Rule 2).
- **Speed:** at least 60×, but never longer than 30 s, so the speed rises to fit (12 hours plays at about 1,440×). The brief said 60×; at 60× a night would take 12 minutes, so the 30 s cap follows the "an evening in 20 seconds" intent in `tycoon-mode.md`.
- **Map:** while it plays, `WorldMap` hands the globe the replayed legs in the air as stand-in aircraft (the real aircraft's model, so the right icon) on a replay clock passed through the existing `engineClock` ref. Rivals and landing bursts are hidden. The clock moves every frame through a ref; the plane list changes only when a leg departs or lands (checked 5×/s), so React barely re-renders. It hands the map back 2 s after the end, or on Stop/Escape.
- **Replay bar** (portaled above the app chrome): replayed local time, speed, "N of M flights landed", progress, Stop. en/es.
- **Tests:** `timeLapse` utils (legs, window, speed, clock, planes in the air, stand-ins), the playback hook (fake rAF: planes per leg, auto-stop), the bar (progress, stop, Spanish) and the away report button. The e2e (`away-report.spec.ts`) plays the replay after 12 h away, sees flights land and the map handed back. Screenshot: [`media/s55/time-lapse.png`](../media/s55/time-lapse.png).

2026-10-07 · S55.4 · (this commit) · **Alert when an event starts on your routes.**

- **Rule** (`worldEventAlerts.ts`, pure): events from the deterministic schedule that start between two engine ticks at an airport on one of the player's active routes. It looks back at most an hour, so a catch-up after an absence doesn't announce stale "just started" events (the away report covers those).
- **Bridge:** `NotificationBridge` follows the engine tick. With alerts on, the browser's permission granted and ACARS out of view, it shows "Event on your routes: Festival at BCN has just started. Your routes: MAD–BCN.", once per event per visit (tag `acars-worldEvents-<id>`).
- **Settings:** a fifth category, "World events", on by default like the others; the settings card picks it up. en/es.
- **Tests:** the rule (the pinned 2026-10-06 09:00 UTC festival at BCN, other airports, suspended routes, the one-hour look-back) and the bridge (once, jitter, in view, category off). The e2e (`world-event-alert.spec.ts`) pins the clock at 08:45 UTC, flies MAD → BCN, puts the page in the background and gets the notification at 09:00. Strikes and congestion notify too: they are just as much "act now".

## Follow-ups

_None yet._

## Handoff notes

- **Shipped:** all four steps of option C.
  - Real first suggestions ranked for a 1–2 h first landing (S55.1).
  - A fourth, event-themed daily objective (S55.2).
  - "Watch what happened": a time-lapse of the absence on the map (S55.3).
  - System alerts when an event starts on your routes (S55.4).
- **Acceptance criteria:** the code paths are in place for all three. Whether new airlines actually land in their first session needs the funnel report (time to first landing), which is also D5's bar for building a fast mode (`tycoon-mode.md`).
- **Didn't:** alerts while the app is closed. That is the Nostr DM bot (D3, later).
- **Gotchas:**
  - The daily objective list is now 3 or 4 long. Anything that assumed exactly `DAILY_OBJECTIVE_COUNT` items per day should use the list's length.
  - The time-lapse speed is "at least 60×, at most 30 s", not a flat 60×: see the S55.3 log line.
  - Web tests import `@acars/core` from `dist`: rebuild core (`pnpm --filter @acars/core build`) after changing it.
