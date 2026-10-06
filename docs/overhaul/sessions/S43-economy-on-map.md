# S43 — Economy on the map

> **Status:** ☑ merged
> **Next step:** — (merged in #180)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #180
>
> **Track:** Graphics · **Size:** M (3 steps) · **Depends on:** S42, S23 (S33 for event pins) · **Unblocks:** —
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Money and opportunity are visible on the world itself.

## Why (evidence)

- Audit §2.8 and U11 (no juice).

## Read first

- S23 `projectRouteEconomics`
- landing events in the store/timeline

## In scope

- Floating `+$` labels on landings (pooled, capped count)
- Opportunity heatmap from the selected hub (projected profit/day per destination, computed in a worker, cached per hub + tick bucket)
- Event pins from S33 if merged

## Out of scope

- Sound (follow-up).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S43.1** Pooled floating `+$` landing labels (reduced-motion aware). _Done when:_ screen recording.
- [x] **S43.2** Worker-based opportunity computation + cache per hub/tick bucket. _Done when:_ no main-thread task > 50 ms.
- [x] **S43.3** Heatmap layer + event pins (if S33 merged). _Done when:_ screenshots.

## Details & guidance

- Respect `prefers-reduced-motion`.
- Heatmap computation must stay off the main thread.

## Acceptance criteria

- [x] Screenshots/video; no main-thread long tasks > 50 ms from the heatmap (main thread: 0 ms post, 0.1–0.3 ms reply).

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S43.1 · (this commit) · **Landing labels.** Your landings float a label (`+$12.3K` green, `−$1.2K` red) above the destination airport for 1.8 s.

- **Map package.** New `bursts.ts`:
  - `BurstPool`: at most 6 labels; reuses a free slot or recycles the oldest; each id shown once (bounded memory); timers injected for tests.
  - `createMarkerSlot`: a MapLibre marker wrapper, with the label animated inside it so its transform doesn't fight the marker's. Uses Web Animations (rise and fade), or fade only under `prefers-reduced-motion`, or static without WAAPI.
  - The Globe gains a `bursts` prop and owns one pool per map.
- **Web.**
  - `landingBursts()`: a landing's profit (else revenue) at its destination; compact USD; ferries, other events and unknown airports skipped.
  - `useLandingBursts`: the same new-event detection as the toasts. It skips catch-ups (the away report covers them) and keeps the last 6.
  - `WorldMap` passes them to the Globe.
- **Refactor.** The toast bridge's new-event slice became the shared `newTimelineEvents()`.
- **Recording.** The harness now serves the real `bursts.ts` (transpiled with vite's `transformWithEsbuild`) and maplibre's CSS. Two new scenes:
  - Ten simultaneous landings show 6 labels, which then disappear.
  - Under reduced motion the keyframes carry no transform.
  - `S43_VIDEO=1` records them; `bursts.png` and `landing-labels.webm` were checked by eye.
- **Tests.** Pool (dedupe, cap and recycling, expiry, clear, memory bound, real timers), slot (placement, animation, reduced motion, no WAAPI), formatter, hook (order, cap, catch-up skip).

2026-10-06 · S43.2 · (this commit) · **Opportunities off the main thread.**

- **Computation.** `hubOpportunities.ts`:
  - `candidateDestinations` picks the 60 most populous airports in the tier's range (≥ 200 km) that the hub doesn't serve yet.
  - `computeHubOpportunities` projects each with `recommendAircraftForRoute`: the same profit/day after lease the Opportunities list shows, with rival offers from the global registry and the candidate in the network.
  - `opportunityCacheKey` (hub + game hour + network signature) and an LRU `OpportunityCache` (8 entries).
- **Worker.** `opportunityRequests.ts` `createOpportunityHandler` serves from the cache or computes once the airports catalog is loaded. `workers/opportunities.ts` is a module worker wired to it.
- **Hook.** `useHubOpportunities(hub)` creates the worker lazily (one per hook) and re-asks only on hub, game-hour or network changes. It drops superseded replies and terminates the worker on unmount.
- **Cost.** One hub on the real catalog takes 40–100 ms (MAD tier 1/2, JFK tier 3, desktop CPU): over the 50 ms long-task budget, so it stays in the worker. Main-thread long tasks are measured in the app in S43.3, once the layer uses the hook.
- **Tests.** Candidates (range, minimum distance, served, limit), ranking, cache key and LRU, handler caching, hook (inputs, hour throttle, stale replies, no hub, terminate).

2026-10-06 · S43.3 · (this commit) · **Opportunity map.**

- **Map package.** `opportunities.ts` `buildOpportunityFeatures`: profit/day → score −1…+1, scaled to the 80th-percentile |profit| (`opportunityScale`) so one outlier, e.g. +$252K/day, doesn't flatten the rest. Heat weight is the positive part. `layers/opportunities.ts` adds a heatmap (glow where money is; fades out by z7) and coloured points (the route profit ramp, red → amber → green; sized by |score|), under the hub glow and airports. The Globe gets an `opportunities` prop.
- **Web.**
  - **Toggle.** `WorldMap` adds an Opportunities toggle above the theme button (players only; off by default; remembered in localStorage).
  - **Hub.** The selected airport if it's one of your hubs, else your main hub.
  - **Key.** "Opportunities from MAD", left of the buttons and above the route key when that shows, with Computing… / empty states. en/es strings.
- **Build fix.** `vite.config` `worker.format: "es"`: the worker lazy-loads the airports catalog, which code-splits; IIFE workers can't. Both app workers are already `type: "module"`.
- **e2e** `opportunity-map.spec.ts`: a new player turns it on; the worker answers. A probe wraps the worker and measures the main-thread cost: `postMessage` 0 ms, reply handling 0.1–0.3 ms (asserted < 50 ms). The 40–100 ms compute stays in the worker. It also checks that off clears the layer and persists. `opportunity-map.png` was checked by eye.
- **Not done.** Event pins: S33 (world events) isn't merged, so there's nothing to pin.

2026-10-06 · S43.3 fix · (this commit) · **CI e2e race.** The key said "green earns…" whenever the hook wasn't pending and had no result yet. That happens on the first render, before the worker request is posted. On CI the e2e saw the key before any reply and failed: the worker probe had 0 replies. The legend now shows Computing… until there is a result for the hub, which also removes a flash of the key in the UI. There's a unit test for that state; the e2e passed twice locally.

## Follow-ups

- **Event pins.** Add S33 world-event pins to the globe once S33 lands; the brief made them conditional.
- **Candidate data.** Candidates come from the catalog by metro population, so closed or secondary airports of a big metro can show (e.g. Berlin SXF/THF). A catalog `active`/primary-airport flag would clean the map and the Opportunities list alike.
- **Sound** on landings (out of scope here).

## Handoff notes

- **Shipped.**
  - Pooled floating `+$`/`−$` landing labels: at most 6 MapLibre markers; Web Animations; fade only under reduced motion; catch-ups skipped.
  - The opportunity computation in a module worker, cached per hub, hour and network.
  - The heatmap and points layer with a toggle and key.
- **Not done.** Event pins (S33 not merged).
- **Gotchas.**
  - MapLibre markers need `maplibre-gl.css` (the harness serves it).
  - Animate an inner element, not the marker (MapLibre owns its transform).
  - A factory passed inline into a hook must not be an effect dependency.
  - Code-splitting workers need `worker.format: "es"`.
  - Normalise scores by a percentile, not the max.
