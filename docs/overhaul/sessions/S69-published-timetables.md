# S69 — Published timetables (changes take effect tomorrow)

> **Status:** ☑ merged
> **Next step:** — (merged in #201)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #201 (with S68)
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

- [x] **S69.1** Core: `Route.pending`, `FlightOffer.next`, `nextUtcDayStartTick`, `routeAt`, `offerAt`, `scheduleChangeTiming` (now / tomorrow, with the reason), `mergePending`; tests.
- [x] **S69.2** Store: replay defers fares and frequency per the rule; optimistic slice does the same; engine and catch-up price with `routeAt`/`offerAt`; registry offers carry rivals' announced changes; pending promoted when due; tests (replay = optimistic, midnight switch).
- [x] **S69.3** Web: fare editor and frequency control explain timing and show today's values; "changes tomorrow" badge; rivals' announced changes; i18n.
- [x] **S69.4** e2e (desktop and phone), screenshots, PR.

## Progress log

2026-10-12 · brief · (this commit) · Written after the owner's D12 "next day" and a read of how fares and frequency flow from the replay (`ROUTE_UPDATE_FARES`/`ROUTE_UPDATE_FREQUENCY`) into the engine and the rivals' registry.

2026-10-12 · S69.1 · (this commit) · **The rule, in core.** `timetable.ts`: `nextUtcDayStartTick`, `isPublished` (opened before today, UTC; routes without an open tick count as on sale), `routeAt`/`offerAt` (an announcement applies from its tick, only its fields), `scheduleChangeTiming` (now on a route opened today; now for a frequency rise within `JOIN_GRACE_TICKS` = 1 h after a plane joined; otherwise next 00:00 UTC), `applyRouteChange` (puts a due announcement in force first, merges same-day changes, drops fields set back to today's value, new capacity overrides an announced frequency). Types: `Route.pending`, `FlightOffer.next`, `RouteChange`. 14 tests; core 445/445, 100 % functions.

2026-10-12 · S69.2 · (this commit) · **The rule, in the game.**

- Replay: `ROUTE_UPDATE_FARES` and `ROUTE_UPDATE_FREQUENCY` go through `applyRouteChange` (the join tick comes from the route's planes, `lastJoinTickOn`); the timeline says "Announced new fares … from 00:00 UTC tomorrow" or "flies N round trips a week from 00:00 UTC tomorrow" when the change waits.
- Store: `updateRouteFares`/`updateRouteFrequency` apply the same rule optimistically (a frequency equal to the one already announced is a no-op) and roll back the whole timetable (fares, frequency, announcement) when publishing fails. The engine slice puts due announcements in force each tick.
- Engine: `processFlightEngine` and `reconcileFleetToTick` fly `routesInForce(routes, tick)`; rival offers come through `offersInForce(registry, tick)` (lines too: `LineEngineContext.registry` is an `OfferLookup`). Rivals' registry offers carry their announced fares as `next` (their frequency comes from their planes, so only fares ride along).
- Tests: replay (same-day open is immediate, published route announces, a rise right after a join is immediate), engine lookups, `lastJoinTickOn`, slice (announce, immediate on a new route, no-op repeat, rollback, earlier announcement kept), engine slice promotion, rivals' offers. Store 311/311; web 682/682 unchanged.

2026-10-12 · S69.3 · (this commit) · **Seen and explained.**

- `TimetableNote.tsx`: `TimetableAnnounced` (chip "From 00:00 UTC: E $80 · 3/wk" on the route card and in the fare editor), `TimetableHint` (published: "changes take effect at 00:00 UTC tomorrow, so rivals see them coming"; opened today: "changes apply now"; a plane just joined: "the extra flights start now"), `RivalAnnounced` (a rival's coming economy fare in the route's competition list; the list itself shows offers as in force now, `offerAt`).
- Fare editor: starts from the planned fares (announced ones if any), the button reads "Announce for tomorrow" on a published route and confirms with a toast. Frequency control: steps from the planned frequency; the button and hint follow `scheduleChangeTiming` (with the route's latest join, `lastJoinTickOn`, now exported by the store).
- i18n en/es `timetable.*`. Tests: chip, hints, rival note, editor (now vs announce, seeded from the announcement), frequency (announce, new capacity). Web 689/689.

2026-10-12 · S69.4 · (this commit) · **On screen, through midnight.** e2e `timetable.spec.ts` (1440) and `mobile-timetable.spec.ts` (390) with a new journey, `publishedRoute` (MAD → BCN launched at 23:30 UTC, clock run past midnight): one fewer round trip → "Announce for tomorrow" and the 00:00 UTC hint; an economy fare $10 lower → the card's chip reads "From 00:00 UTC: E $… · N/wk"; then the clock runs to the next 00:05 UTC and the chip is gone, the frequency and fare are in force. The same-day specs (route frequency, fare editor, what-if, first hour) still pass unchanged. Screenshots: `media/s69/timetable-announced-1440.png`, `media/s69/timetable-announced-390.png`. Ships in #201 with S68 (same branch).

2026-10-12 · merged · — · Merged in #201 (with S68–S74).
