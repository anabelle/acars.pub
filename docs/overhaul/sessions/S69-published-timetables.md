# S69 — Published timetables (changes take effect tomorrow)

> **Status:** ◐ in progress
> **Next step:** S69.1 — core: `routeAt`, `offerAt`, `scheduleChangeTiming`
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** — (next)
>
> **Track:** Decisions · **Size:** M (4 steps) · **Depends on:** D12 ✅ (2026-10-12), S66 · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §4 Decisions, §5 game theory

> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Fares and schedules are published, like a real airline's: a change made today takes effect at 00:00 UTC tomorrow. Being online at 3 a.m. stops paying; rivals see an announced change and have the rest of the day to answer.

## Design

- **What waits for tomorrow:** fare changes and frequency changes on a route that is already _published_, i.e. opened before today (UTC). The change is stored on the route as `pending` (only the fields changed) with `effectiveTick` = next 00:00 UTC; a later change the same day merges into it; a change back to today's value drops it.
- **What applies now (so starting out stays fun):**
  - Anything on a route opened today (it isn't on sale yet).
  - A frequency rise within an hour of a plane joining the route (the automatic S58 raise): new capacity flies at once, cuts wait.
- **One rule, everywhere:** `routeAt(route, tick)` and `offerAt(offer, tick)` (core, pure) give what is in force at a tick. The engine prices every landing with them (live and catch-up, ours and rivals'), the store promotes pending changes once their tick passes, and the replay gives every client the same result.
- **Visible:** the fare editor and frequency control say "from 00:00 UTC tomorrow" and show what is in force today; routes with an announced change carry a badge; rivals' announced changes show in the route's competition list.
- **Not now:** swapping a plane's line of flying mid-day stays immediate (it moves only your own plane); next-day lines can follow when banks need it.
- **Bounded:** one comparison per route per lookup; nothing new per passenger or per tick beyond the existing route map.

## Steps (checkpoints)

- [ ] **S69.1** Core: `Route.pending`, `FlightOffer.next`, `nextUtcDayStartTick`, `routeAt`, `offerAt`, `scheduleChangeTiming` (now / tomorrow, with the reason), `mergePending`; tests.
- [ ] **S69.2** Store: replay defers fares and frequency per the rule; optimistic slice does the same; engine and catch-up price with `routeAt`/`offerAt`; registry offers carry rivals' announced changes; pending promoted when due; tests (replay = optimistic, midnight switch).
- [ ] **S69.3** Web: fare editor and frequency control explain timing and show today's values; "changes tomorrow" badge; rivals' announced changes; i18n.
- [ ] **S69.4** e2e (desktop and phone), screenshots, PR.

## Progress log

2026-10-12 · brief · (this commit) · Written after the owner's D12 "next day" and a read of how fares and frequency flow from the replay (`ROUTE_UPDATE_FARES`/`ROUTE_UPDATE_FREQUENCY`) into the engine and the rivals' registry.
