# S62 — Instruments and the check-in story (Today)

> **Status:** ◐ in progress
> **Next step:** S62.3
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
>
> **Track:** UX/Story · **Size:** M (3 steps) · **Depends on:** S59, S61 · **Unblocks:** S63, S65 · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §5 (check-in loop), §6 Decisions, §8 Story
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Opening the game should answer three questions in five seconds: how did the day go, are my planes working, and what needs me now. The cockpit opens on a short logbook-style story of the last 24 hours and four avionics instruments, each with a target band and a one-tap fix.

## Why (evidence)

- Blueprint: "Check-in: the story: what you earned, your top plane, three things that need you, one tap each."
- Before (S62 capture, 2026-10-11): the cockpit opens on a large "E2E Air at a glance" header and the first-hour checklist; numbers that change decisions (utilization, margin) are not there.

## Instruments (honest: only what the game knows)

| Instrument                          | Source                                          | Band      | Fix                                  |
| ----------------------------------- | ----------------------------------------------- | --------- | ------------------------------------ |
| Utilization (block h/day per plane) | last 24 h legs (`summarizeFleetDays`)           | 8–13 h    | "Fly more" on underused routes (S58) |
| Load factor                         | last 24 h landings `details.loadFactor`         | 75–92 %   | Routes (fares, planes)               |
| Unit margin                         | last 24 h landing profit ÷ revenue              | 10–25 %   | Routes (fares)                       |
| Cash runway                         | balance ÷ daily loss; "growing" when profitable | ≥ 30 days | Finance                              |

Each shows the value, the band, a trend against the previous 24 h, and colour by state (green in band, amber out, red far out). On-time is **not** shown: the engine has no delays yet (comes with weather, Wave B).

## Steps (checkpoints)

- [x] **S62.1** `computeInstruments` (pure, one pass over the timeline) + `InstrumentPanel` (cockpit gauges with band, trend, fix). _Done when:_ unit tests per instrument (in band, low, high, no data) + component test.
- [x] **S62.2** `buildTodayStory` (pure) + `TodayStory` (Ramp): a header (date sign, earned / people flown / landings) and up to five chapters from the last 24 h — deliveries (with the painting), the best flight, people turned away (pictograms, "add a plane"), and "Now · needs you" (idle planes, one tap). _Done when:_ unit tests per chapter + component test.
- [ ] **S62.3** Cockpit opens on Today + instruments for the player's own airline (guests and other airlines keep the overview); landing toasts read money; toasts dark. e2e with a flying airline; 1440/390 screenshots; PR.

## Acceptance criteria

- [ ] An airline that has flown sees, without scrolling at 1440, what it earned in the last 24 h and its four instruments.
- [ ] Every out-of-band instrument and every "needs you" chapter has a one-tap action.
- [ ] Nothing is invented: chapters and instruments only use the timeline, fleet and routes.
- [ ] Clipped-control audit, perf probes and the full e2e suite green.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-11 · brief · (this commit) · Written after a before-capture of the cockpit for a 6-hour-old airline. Also fixes found in that capture: landing toasts printed a raw number ("Net Profit: +8.7863") and toasts were light on the dark theme.

2026-10-11 · S62.1 · (this commit) · **Instruments.**

- `computeInstruments` (`features/cockpit/utils/instruments.ts`): one pass over the timeline for the last 24 h and the 24 h before; utilization = landed block hours ÷ delivered planes, load factor = mean recorded load, margin = profit ÷ revenue, runway = balance ÷ daily loss after fixed costs (hub opex, leases), "growing" when the airline keeps money. States: normal in band, caution out of band, warning when far below (above the band is only ever a caution).
- `InstrumentPanel`: four cockpit gauges (value in the state's colour, trend ▲▼, the band as a green segment with a needle, the band in words) and a sign-yellow fix button only when out of band; fixes are passed in by the cockpit. en/es.
- Tests: instruments (in band, low, high, runway, no data), panel (reading, trend, fix only out of band, no data).

2026-10-11 · S62.2 · (this commit) · **The Today story.**

- `buildTodayStory` (pure, one pass): earned, people flown and landings for the last 24 h; chapters in time order — deliveries (own planes only; airport from the plane's base, as the event has none), the best profitable flight, the route that turned most people away (≥ 10, from `spilledPassengers`) — closed by "Now · needs you" for parked planes; at most five.
- `TodayStory` (Ramp ground): a "Today · <date>" location sign and UTC clock, a summary line (green/red earnings), chapters on a magenta line; deliveries show the painting on a slab; turned-away shows pictograms (boarded vs stayed behind) and "Add seats on this route"; parked shows "Put <name> to work". Quiet days say so. en/es with plurals.
- Tests: story helper (order, sums, filters), component (summary, each chapter, both actions, quiet day).
