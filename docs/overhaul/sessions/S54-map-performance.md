# S54 — Map performance: stop the constant redraws

> **Status:** ☑ ready for review
> **Next step:** — (awaiting merge of #183)
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
- [x] **S54.3** Low-power mode (software renderer, slow frames, hidden map). _Done when:_ software rendering idles at ≤ ~1–2 redraws/s and the page stays responsive.
- [x] **S54.4** CI budget + before/after numbers. _Done when:_ the probe fails CI above budget.

## Details & guidance

- Measure under the same conditions before and after each step. The headless shell renders in software, which is exactly the slow case.
- Never trade correctness for frames: aircraft still move (in steps) in low-power mode.

## Acceptance criteria

- [x] Idle play requests at most the flight cadence in redraws (5/s), and about 1/s in low-power mode.
- [x] Main-thread long tasks during idle play drop sharply against the baseline.

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

2026-10-07 · S54.3 · (this commit) · **Low-power mode.** New `packages/map/src/renderMode.ts`.

- **Switching on.** Low-power mode starts on when the unmasked WebGL renderer is a software one (SwiftShader, llvmpipe, softpipe, "Basic Render Driver"). Otherwise `FrameCostGovernor` switches it on when the smoothed frame cost passes 100 ms, and back off only after 20 frames under 40 ms. Frame cost is the gap between two animation frames with a map redraw in between, which doesn't depend on how often we draw, so the mode can't oscillate.
- **In low-power mode:** the map clock ticks once a second, the route flow is off, and the canvas renders at 1× pixel ratio. Aircraft still move.
- **Always on, for everyone:**
  - no clock ticks while the map canvas is off screen (`IntersectionObserver`);
  - no symbol cross-fade (`fadeDuration: 0`). The 300 ms fade turned every position upload into several extra frames.
- **`__acarsMapStats.lowPower`** reports the mode.
- **Probe.** It now steps game time until the route's aircraft is airborne (MAD → BCN flies once a day, and an idle map now draws nothing at all), then samples 15 s mid-flight:

| state                        | requests/s | renders/s | draws/s | long-task ms/s |
| ---------------------------- | ---------- | --------- | ------- | -------------- |
| low-power, before fade fix   | 0.9        | 3.3       | 367     | 786            |
| low-power, `fadeDuration: 0` | 0.9        | 2.1       | 227     | 451            |

- **Remaining cost.** About 2 frames per upload is MapLibre's own GeoJSON round trip: a frame at `setData`, and one when the worker returns the tiles.
- **Idle map.** With no aircraft in the air, the map draws nothing at all: 0 requests and 0 renders (verified while debugging).

2026-10-07 · S54.4 · (this commit) · **Budgets.**

- **Override.** `acars_map_render_mode` in localStorage (`low` / `full`; unset is automatic) fixes the mode and stops the governor. Pure reader: `readRenderModeOverride`.
- **Two budgeted runs** in `perf-probe.spec.ts`, serial so they don't compete for the CPU:
  - **Automatic:** CI's software WebGL must land in low-power mode, with ≤ 1.5 redraw requests/s and ≤ 3 frames/s.
  - **Forced full mode** guards the one-clock cadence: ≤ 5.5 requests/s (the old code was at 7.3 even with starved timers).

  The budgets are rates, not timings, so a slower CI machine can't fail them; long-task cost is logged only.

- **Before/after**, idle play mid-flight, headless shell (software WebGL):

| run                                     | requests/s | renders/s | draws/s | long-task ms/s |
| --------------------------------------- | ---------- | --------- | ------- | -------------- |
| baseline (S54.1)                        | 7.3        | 4.3       | 431     | 978            |
| after, automatic (low-power)            | 1.0        | 2.1       | 227     | 504            |
| after, forced full mode                 | 1.9        | 4.3       | 477     | 985            |
| after, nothing in the air (either mode) | 0          | 0         | 0       | ~0             |

- **On a GPU machine** the automatic mode stays full, and the gain is fewer redraws: about 5/s mid-flight instead of about 15/s, and none at all while nothing flies (the old code redrew all the time).

## Follow-ups

- A visible "Performance mode" toggle (force low-power on/off) in settings.
- Move flight positions off GeoJSON `setData` (e.g. a custom layer that animates on the GPU) to drop the worker round trip.

## Handoff notes

- **Shipped:**
  - render counters (`window.__acarsMapStats`);
  - one map clock (flights and route flow share a redraw; unchanged writes are skipped);
  - low-power mode (software renderer or slow frames: 1 update/s, no flow, 1× pixel ratio);
  - no clock while the map is off screen; no symbol cross-fade;
  - a localStorage override;
  - a budgeted perf probe in CI.
- **Measured:**
  - Software WebGL, mid-flight: main-thread blocking roughly halved (978 → 504 ms per second).
  - Any machine with nothing in the air: the map no longer redraws at all.
- **Not shipped:** a settings toggle for the mode, and moving aircraft off GeoJSON `setData` (each upload still costs MapLibre a worker round trip and about 2 frames). See Follow-ups.
- **Gotchas:**
  - The probe must sample while an aircraft is airborne. An idle map now draws nothing, so the probe steps game time until positions upload.
  - Run perf measurements serially: parallel e2e workers double the long-task numbers.
