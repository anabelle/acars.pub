# S43 — Economy on the map

> **Status:** ◐ in progress
> **Next step:** S43.3
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
- [ ] **S43.3** Heatmap layer + event pins (if S33 merged). _Done when:_ screenshots.

## Details & guidance

- Respect `prefers-reduced-motion`.
- Heatmap computation must stay off the main thread.

## Acceptance criteria

- [ ] Screenshots/video; no main-thread long tasks > 50 ms from the heatmap.

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

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
