# S41 — Living routes

> **Status:** ☑ ready for review
> **Next step:** — (all steps done; awaiting review)
> **Branch:** claude/zen-darwin-3op878
> **PR:** https://github.com/anabelle/acars.pub/pull/171
>
> **Track:** Graphics · **Size:** M (3 steps) · **Depends on:** S40 · **Unblocks:** S42
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Routes show the business: color by profit, width by frequency, motion by direction.

## Why (evidence)

- Audit §2.8: routes are static flat lines.

## Read first

- `packages/map/src/layers/*` (after S40)
- store selectors for route profit (cockpit computes strongest/weakest)

## In scope

- Data-driven line color (profit/hour → green to red), width (weekly frequency), animated dash flow
- Rival routes thinner, in their livery color; a "my network / world" toggle

## Out of scope

- 3D arcs (S45).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S41.1** Route feature properties: profit/hour, weekly frequency, owner. _Done when:_ unit tests for property builder.
- [x] **S41.2** Color/width expressions + legend chip. _Done when:_ screenshots.
- [x] **S41.3** Dash-flow animation + my-network/world toggle. _Done when:_ frame time within 10% of S40.

## Details & guidance

- All styling via feature properties and expressions (no per-frame JS loops over routes).
- Legend chip in the map corner.

## Acceptance criteria

- [x] Screenshots; frame-time unchanged within 10% vs S40 numbers (see S41.3).

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S41.1 · (this commit) · New `packages/map/src/routeFeatures.ts`, exported from the package. `MapRoute` describes what the map draws per route: owner, `isPlayer`, `frequencyPerWeek`, `profitPerHour` (null until flown) and the rival's livery `color`. `routeFeatureProperties` derives `profitScore` (−1…+1), profit normalised against the player's largest |profit|, so the colour ramp works at any airline size; unknown profit stays null. Frequency defaults to 7 and is at least 1. `buildRouteFeatures` makes one origin→destination arc per route, so a dash animation flows in the direction of travel. It splits at the antimeridian, skips unknown airports and takes a culling predicate plus the caller's arc cache. Context: today the globe draws the player's lines per aircraft in flight (`arcs`), not per route, and gets no player routes; S41.2 switches to route features. 6 tests, 100% coverage.
2026-10-06 · S41.2 · (this commit) · The globe now draws the player's **routes** (new `playerRoutes` prop) instead of one dashed arc per aircraft in flight, and rivals' routes in their livery. Both go through `buildRouteFeatures` with the existing culling and arc cache; the duplicated arc loops in the data and pan/zoom effects became one `buildArcs`. Styling is pure expressions in `layers/routes.ts`. Player colour comes from `profitScore`: red (−1) through amber (0) to green (+1), using the theme colour until a route has flown. Width comes from weekly frequency (1→0.8, 7→1.6, 21→2.8, 42→4) times zoom; rivals get half width at 0.3 opacity with livery colour (`coalesce` to the theme). Profit, frequency and colour are part of the arc signature, so a changing profit repaints. Default props for rival routes and liveries are now stable constants (new `[]`/`Map` each render re-ran every arc effect). Web: `utils/mapRoutes.ts` `toMapRoutes` turns active routes plus `useRoutePerformance` profit per hour into `MapRoute`s, null until a landing. `RouteLegend` is a bottom-right chip (sm+, left of the theme toggle) reading "Your routes · Losing–Break-even–Earning · Thicker = more flights a week" (en + es). Screenshot check: MAD–BCN green and MAD–LIS olive after 6 h. `map.spec.ts` poll timeout went from 30 to 60 s, with the test timeout raised to 90 s (Playwright's default is 30 s, and the 30.8 s failure was the whole test timing out): under 4 parallel workers the software-rendered globe took about 28 s and once ran out (passes alone 3/3 at ~21 s, and the full suite 26/26 on re-run). Tests: expressions, signature, `toMapRoutes`, `RouteLegend`; map coverage 100% lines.
2026-10-06 · S41.3 · (this commit) · **Flow:** a new `arcs-flow-layer` draws light dashes (white, 0.55 opacity, 0.45× width) over the player's routes. The globe steps `line-dasharray` through `ROUTE_FLOW_DASHES` (14 patterns) every 100 ms, so the dashes travel origin → destination. It is skipped for prefers-reduced-motion, hidden tabs and airlines with no routes. **Toggle:** the `showWorld` prop toggles the visibility of `WORLD_LAYER_IDS` (rivals' routes, aircraft and lights). When off, the animation loop also stops interpolating rivals' aircraft. The web puts a My network / World segmented control in the route legend, remembered per viewer in localStorage (`acars_map_show_world`, try/catch, defaults to World). en + es. Perf: same harness as S40.4 (production build, 10k rival aircraft, desktop globe world view, temporary hooks not committed):

| Case                  | fps | p95 frame | JS       |
| --------------------- | --- | --------- | -------- |
| S40                   | 2.1 | 600 ms    | 264 ms/s |
| S41, no player routes | 2.2 | 567 ms    | 249 ms/s |
| S41, 30 routes + flow | 2.1 | 617 ms    | 256 ms/s |
| S41, My network       | 4.5 | 267 ms    | 24 ms/s  |

Within 10% of S40: p95 +2.8%, JS −3%. My network removes about 90% of the JS cost. Tests: flow dash stepping and wrap, world layer ids, legend toggle; e2e 26/26.

## Follow-ups

_None yet._

## Handoff notes

- **Shipped:**
  - The player's routes are drawn per route, coloured by profit per hour (red, amber, green, normalised to the network) and sized by weekly frequency.
  - Rivals' routes are thinner, in their livery.
  - Dashes flow in the direction of travel.
  - A legend with a My network / World switch.
  - Frame cost is within 3% of S40; My network is much cheaper.
- **Gotchas:**
  - Route colours need `useRoutePerformance` (timeline landings), so a route is neutral until it lands a flight.
  - Rival routes have no profit (only their livery colour).
  - The globe's default props must be stable constants, or the arc effects re-run every render.
  - `map.spec.ts` now has a 90 s test timeout because the software-rendered globe is slow under parallel workers.
- **Not done:** 3D arcs (S45).
