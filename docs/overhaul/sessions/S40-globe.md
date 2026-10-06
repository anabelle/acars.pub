# S40 — Real globe + atmosphere + fly-to

> **Status:** ☑ merged
> **Next step:** — (merged in #170)
> **Branch:** claude/zen-darwin-3op878
> **PR:** https://github.com/anabelle/acars.pub/pull/170
>
> **Track:** Graphics · **Size:** M (4 steps) · **Depends on:** S01 · **Unblocks:** S41
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

The world is a globe: atmosphere at low zoom, Mercator up close, and a "from space to your hub" moment.

## Why (evidence)

- Ledger A13: flat Mercator despite "globe" everywhere.

## Read first

- `packages/map/src/Globe.tsx` (~1,780 lines)
- MapLibre ≥ 5 globe projection and sky docs
- `docs/UI_ARCHITECTURE.md`

## In scope

- First, split `Globe.tsx` into `layers/*` modules with no behavior change (so S41–S43 can work in smaller files)
- Globe projection + sky/atmosphere + fog horizon
- Fly-to on hub selection and in onboarding

## Out of scope

- Route and aircraft styling (S41/S42).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S40.1** Split `Globe.tsx` into `layers/*` modules (no behavior change). _Done when:_ S01 map spec green.
- [x] **S40.2** Globe projection + sky/atmosphere + terminator on globe. _Done when:_ screenshots.
- [x] **S40.3** Fly-to on hub selection / onboarding. _Done when:_ screen recording.
- [x] **S40.4** Perf numbers (10k aircraft) recorded in PR. _Done when:_ numbers recorded.

## Details & guidance

- Performance check: 10k simulated aircraft at 60 fps desktop / 30 fps mid-range mobile (record numbers in the PR).
- Keep the day/night terminator working on the globe.

## Acceptance criteria

- [x] S01 map test green; screenshots at both sizes; perf numbers recorded (below). The 60/30 fps targets are **not** verified: see S40.4.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-05 · S40.1 · (this commit) · `Globe.tsx` went from 1,781 to 857 lines, split without behaviour change. `theme.ts` holds style URLs and palettes. `layers/` has `nightOverlay.ts` (lookup tables, `paintNightCanvas`, `addNightOverlay`), `sources.ts` (`addDataSources`), `routes.ts` (`getSegmentCount`, `arcCacheKey`, `addRouteLayers`), `airports.ts` (`isMajorAirport`, `buildPresenceBadge`, `addAirportLayers`) and `flights.ts` (`registerAircraftIcons`, `addFlightLayers`). The load handler calls them in the original order. Code was moved verbatim, sliced by markers. Public exports are unchanged: `Globe.tsx` re-exports them. The new modules are no longer under Globe's coverage exclusion, so `layers/layers.test.ts` drives them with a fake map and canvas. It asserts the exact source and layer ids and z-order (17 layers, glow under the player's aircraft), palette use, icon registration and day/night alpha. Map coverage is 100% lines and functions. e2e 26/26, including the S01 map spec.
2026-10-05 · S40.2 · (this commit) · New `layers/globeView.ts`. `applyGlobeView` runs on every `style.load` (projection and sky belong to the style): it sets MapLibre's `globe` projection, which switches to Mercator by itself when zoomed in close, and a themed sky. Each palette gained `sky` (space, horizon glow, haze), and `atmosphere-blend` fades from 1 at zoom ≤5 to 0 at zoom 7. The day/night canvas overlay renders on the sphere unchanged. A first visit (no saved view) opens at `globeFitZoom`, the whole planet fitted to the viewport's shorter side (zoom −0.44 on a 390 px phone); the existing first-selection fly-in then takes it to the home airport at zoom 4.5, so the space-to-hub moment already plays. Checked with screenshots at 1440 and 390 using a contrasting test basemap: sphere edge, atmosphere rim and terminator are visible. Cost: in headless software rendering, 5 s of fake-clock time takes 12 s to render as Mercator, 19 s as a globe and 29 s as a globe with the atmosphere; real GPUs differ, see S40.4. `away-report.spec.ts` now uses `clock.fastForward(35s)` to fire the last-seen heartbeat instead of `runFor`, which rendered every frame and timed out on the globe; same intent. e2e passes 26/26 in 4.3 min; the player flows take about 1.3 min of their 2 min budget.
2026-10-05 · S40.3 · (this commit) · New `camera.ts` `planCameraFlight`. Duration grows with great-circle distance (1.2–4 s). Hops of 2,500 km or more cap the flight's zoom-out at the whole-globe view, so a long jump rises to space and comes back down, the from-space-to-your-hub moment. The globe's focus effect uses it for every selection: on load the first focus is your hub at zoom 4.5; later ones keep your zoom if you are closer in. Hub selection in onboarding already drives the map (`setHub` → `homeAirport` → `selectedAirport`), so picking SYD in the creator flies there across the globe. `flyTo` is no longer `essential`, so people with prefers-reduced-motion get a jump cut. 4 planner unit tests. Recorded locally on video (creator → Pick a Different Hub → Sydney) and attached to the PR conversation; software GL drops frames, so it is choppier than on a GPU.
2026-10-05 · S40.4 · (this commit) · Performance numbers, 10,000 rival aircraft in flight. Method: production build served by `vite preview`, headless Chromium. Temporary, uncommitted hooks injected 10k enroute aircraft (50 rival owners, random city pairs) into `fleetByOwner`. The run measured rAF frame rate for 5 s plus CDP `Performance.getMetrics` script time per second; "mobile" is 390×844 at 4× CPU throttling. Results:

| Scenario                                  | N   | fps | p95 frame | JS (script) |
| ----------------------------------------- | --- | --- | --------- | ----------- |
| Desktop, globe, world (z0.7)              | 0   | 4.2 | 283 ms    | 16 ms/s     |
| Desktop, globe, world                     | 10k | 2.1 | 600 ms    | 264 ms/s    |
| Desktop, Mercator, world                  | 0   | 8.0 | 150 ms    | 22 ms/s     |
| Desktop, Mercator, world                  | 10k | 2.9 | 400 ms    | 263 ms/s    |
| Desktop, globe, Europe (z4, 2.7k in view) | 10k | 1.8 | 633 ms    | 209 ms/s    |
| Mobile 4× CPU, globe, world               | 0   | 4.6 | 250 ms    | 82 ms/s     |
| Mobile 4× CPU, globe, world               | 10k | 1.1 | 1,250 ms  | 561 ms/s    |

Reading:

- **Frame rate:** fps is meaningless here. The container has no GPU, and SwiftShader software rendering saturates the main thread (1,000 ms/s busy) even with an empty world. GPU fps needs a real device.
- **What is meaningful is the game's own JS:** 10k aircraft add about 250 ms/s on desktop. That is about 50 ms per 5 Hz update (fleet interpolation plus two GeoJSON `setData` re-uploads), the same on globe and Mercator. On a throttled phone it adds about 480 ms/s, about 100 ms per update.
- **Verdict:** at 10k aircraft the update alone breaks a 60 fps desktop budget (a 50 ms task every 200 ms) and leaves no room for 30 fps on mid-range mobile. The globe isn't the bottleneck; the per-update JS is. Follow-up filed.

## Follow-ups

- **Aircraft update cost (blocks the 10k perf target).** About 50 ms per 5 Hz update on desktop for 10k aircraft (S40.4). Options, cheapest first:
  - interpolate only in-view aircraft and cap them at low zoom (cluster or sample rivals);
  - lower the update rate when nothing the player owns is moving;
  - move interpolation and GeoJSON building to a worker that posts ready features;
  - use a custom WebGL/instanced layer with positions computed on the GPU from departure/arrival ticks.

  Natural home: S42 (aircraft styling) or a dedicated perf session. Measure on a real mid-range phone.

- E2E headroom: the globe makes player-flow specs about 1.3 min against a 2 min timeout in software GL. Watch CI; if it gets tight, give those specs more time or render a lighter view under automation.

## Handoff notes

- **Shipped:**
  - `Globe.tsx` split into `theme.ts` + `layers/*`, with no behaviour change; a test pins layer order.
  - MapLibre globe projection with a themed atmosphere that fades by zoom 7. The day/night overlay works on the sphere.
  - A from-space first view fitted to the viewport.
  - Distance-aware fly-to (`camera.ts`) that rises to the globe view on long hops; it respects reduced motion.
  - Perf numbers recorded.
- **Not met:** the 60 fps desktop / 30 fps mobile target at 10k aircraft is unverified on GPUs and fails on JS cost (follow-up above).
- **Gotchas:**
  - The globe makes every e2e slower under software GL. Player flows take about 1.3 min of their 2 min budget.
  - Avoid `clock.runFor` over long spans: it renders every frame. Use `fastForward`.
  - `map.loaded()` never settles because flights re-upload at 5 Hz. Wait for a layer instead.
  - MapLibre's worker doesn't load under the Vite dev server in headless runs; benchmark the production build.
  - The benchmark harness needs temporary hooks; its method is described in the S40.4 log line.
