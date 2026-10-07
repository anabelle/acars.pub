# S33 — Deterministic world events

> **Status:** ◐ in progress
> **Next step:** S33.2
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
>
> **Track:** Loop · **Size:** L (3 steps) · **Depends on:** — (run after S32 or in a separate window — shared engine files) · **Unblocks:** S43 (event pins)
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

The world does things: demand surges, fuel shocks and congestion days that create "act now" opportunities.

## Why (evidence)

- Audit §2.3: nothing happens beyond fuel drift and seasons.

## Read first

- `packages/core/src/fuel.ts`, `demand.ts`, `prng.ts`
- `FlightEngine.ts` demand path

## In scope

- `getActiveEvents(tick, ruleset)`: seeded schedule of events with region/airport scope, duration and modifiers
- Engine applies modifiers in O(active events per route endpoint)
- Ticker + map pin data + a cockpit card

## Out of scope

- Weather API integration (non-deterministic; excluded).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S33.1** Event catalog + `getActiveEvents(tick)` + tests. _Done when:_ deterministic schedule.
- [ ] **S33.2** Engine modifiers (constants in core) + S02 impact report. _Done when:_ bounded impact.
- [ ] **S33.3** Ticker/cockpit card + map pin data. _Done when:_ screenshots.

## Details & guidance

- An event catalog (festival, sports final, strike, fuel spike, hub congestion) with modifiers in the ruleset.
- Tests: determinism, bounded effect sizes, no overlap explosions.

## Acceptance criteria

- [ ] The S02 harness shows bounded impact; the same events appear on all clients for the same tick.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · S33.1 · (this commit) · **Catalog + schedule.** New `packages/core/src/worldEvents.ts`.

- **Five kinds:**

| kind           | effect                  | length  | where              |
| -------------- | ----------------------- | ------- | ------------------ |
| festival       | demand ×1.3             | 24–72 h | 12 festival cities |
| sports final   | demand ×1.5             | 12–36 h | 12 cities          |
| strike         | demand ×0.7, fees ×1.25 | 12–48 h | 10 airports        |
| hub congestion | fees ×1.4               | 6–24 h  | 15 big hubs        |
| fuel spike     | fuel ×1.15              | 24–72 h | global             |

Effects apply to routes touching the airport at either end.

- **Schedule.** `getEventsForDay(day)` draws one event a day, or two (40% of days), from a PRNG seeded with the engine day (salted). Two events on the same day never share a kind or an airport. The start hour and length are random within the template's range. Memoized.
- **Lookups.** `getActiveEvents(tick)` looks back only as far as the longest event (3 days), so the cost is constant whatever the tick; `getUpcomingEvents(tick, window)` feeds hints.
- **Effects.** `eventDemandMultiplier`, `eventFeesMultiplier` and `eventFuelMultiplier` combine the overlapping events, clamped: demand stays within [0.6, 1.6], fees ≤ 1.5, fuel ≤ 1.2.
- **No ruleset parameter** (D2: no versioning). Targets are a fixed list of well-known airports, because core can't read the async catalog. A data test checks every target exists in the catalog.
- **Tests:**
  - determinism, pinned for day 600;
  - a year of well-formed days, every kind used;
  - active-event lookup equals a brute-force scan;
  - at most 6 events active at once over a year;
  - upcoming window;
  - either-end matching, clamping of stacked effects, fuel global-only.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
