# S54 — Map performance: stop the constant redraws

> **Status:** ◐ in progress
> **Next step:** S54.3
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #183
>
> **Track:** Graphics · **Size:** M (4 steps) · **Depends on:** S40–S43 (the globe layers) · **Unblocks:** — · **Not gated**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

The game feels light on any machine, including browsers without GPU acceleration.

## Why (evidence)

- The owner reports the game "feels ultra sluggish all the time".
- **2026-10-07 profile:** built app, headless Chromium (software WebGL), airline with one route, 30 s of idle play.
  - The map draws a frame whenever it can: 132 frames, about 100 draw calls each.
  - Long tasks blocked the main thread for 31 of 32 s.
  - JavaScript (React, engine, ticks) took only about 1.6 s; the rest is rendering.
- **Cause.** Every flight update (5/s, two `setData` calls) and every route-flow dash step (10/s) asks for its own full-globe redraw, so idle play requests about 15 redraws a second. On a real GPU that's a waste; without one, each frame costs about 230 ms and the page starves.

## Read first

- `packages/map/src/Globe.tsx`: the flight animation loop, the route-flow interval, the night overlay
- `packages/map/src/bursts.ts` (S43 landing bursts)

## In scope

- A repeatable perf probe: redraws per second, draw calls, long tasks
- One map clock: flight positions and route flow land in the same frame, at one cadence
- A low-power mode: software renderer or slow frames → about 1 redraw a second and no decorative motion; no redraws while the map is hidden
- A CI budget so the redraw rate can't creep back

## Out of scope

- Rewriting layers or changing the look
- deck.gl / the 3D shell (S45)

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S54.1** Perf probe e2e + baseline numbers. _Done when:_ the probe reports redraws/s, draw calls and long tasks for idle play.
- [x] **S54.2** One map clock (flights + route flow in the same frame). _Done when:_ idle redraws/s drop to the flight cadence.
- [ ] **S54.3** Low-power mode (software renderer, slow frames, hidden map). _Done when:_ software rendering idles at ≤ ~1–2 redraws/s and the page stays responsive.
- [ ] **S54.4** CI budget + before/after numbers. _Done when:_ the probe fails CI above budget.

## Details & guidance

- Measure under the same conditions before and after each step. The headless shell renders in software, which is exactly the slow case.
- Never trade correctness for frames: aircraft still move (in steps) in low-power mode.

## Acceptance criteria

- [ ] Idle play requests at most the flight cadence in redraws (5/s), and about 1/s in low-power mode.
- [ ] Main-thread long tasks during idle play drop sharply against the baseline.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · S54.1 · (this commit) · **Probe + baseline.**

- **Counters.** New `packages/map/src/renderStats.ts`: `window.__acarsMapStats` with `renders` (frames MapLibre drew; `render` events) and `requests` (moments the globe pushed a redraw-forcing change: a flight-position upload, a route-flow step). Two increments per frame, kept in production.
- **Probe.** `apps/web/e2e/perf-probe.spec.ts` creates an airline, launches MAD → BCN, returns to the map and samples 15 s. It counts long tasks with a `PerformanceObserver` and WebGL draw calls by wrapping `drawElements`/`drawArrays`, logs per-second rates, and writes `perf-probe.json` when `S54_PERF_OUT` is set. No budgets yet (S54.4).
- **Baseline** (headless shell, software WebGL, CI's browser):

| requests/s | renders/s | draws/s | long-task ms/s | long tasks/s |
| ---------- | --------- | ------- | -------------- | ------------ |
| 7.3        | 4.3       | 431     | 978            | 4.3          |

The page is blocked about 98% of the time. Renders are capped by software rendering (~230 ms a frame); `requests` would be ~15/s on a fast machine (5 flight uploads + 10 flow steps) but timers starve here.

2026-10-07 · S54.2 · (this commit) · **One map clock.** New `packages/map/src/mapClock.ts`.

- **One cadence.** `MAP_CLOCK_MS` (200 ms) for everything that animates the globe. `planMapClockTick` (pure) decides each tick's writes:
  - a flight source uploads while it has aircraft, plus once more to clear it;
  - the flow dash is set only when its step changes.
- **One redraw per tick.** The Globe's animation loop now makes those writes in a single task, so MapLibre folds them into one redraw. The separate 100 ms route-flow interval is gone, and `ROUTE_FLOW_STEP_MS` = `MAP_CLOCK_MS` (the flow cycles in 2.8 s instead of 1.4 s).
- **Idle map.** An airline with nothing in the air no longer re-uploads empty collections 5 times a second, so its map stops redrawing.
- **Probe:** redraw requests drop from 7.3 to 4.0 per second (about 15 to 5 per second on a GPU machine).

| requests/s | renders/s | draws/s | long-task ms/s | long tasks/s |
| ---------- | --------- | ------- | -------------- | ------------ |
| 4.0        | 4.1       | 411     | 972            | 4.1          |

Under software WebGL even 4 frames a second fill the main thread; that's S54.3.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
