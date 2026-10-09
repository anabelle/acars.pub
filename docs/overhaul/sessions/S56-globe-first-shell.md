# S56 — Globe-first shell on MapLibre (D4 = A)

> **Status:** ☑ ready for review
> **Next step:** —
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #191
>
> **Track:** UX · **Size:** L (4 steps) · **Depends on:** S45, S54 · **Unblocks:** — · **Decided by D4 (2026-10-07)**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

The world map is the game. "What matters now" lives in a briefing drawer over the globe, and anything you tap on the globe (airport, aircraft, route) answers in the same compact card, with a door into the full panel. It is built on the existing MapLibre globe (`@acars/map`), not deck.gl. That is the owner's choice for D4 (option A in [`../prototype-report.md`](../prototype-report.md)).

## Why (evidence)

- The S45 prototype showed that the drawer-and-cards model works and is easy to read.
- Measured performance clears the bar:
  - Desktop: 89 fps with 50k aircraft.
  - Android: 30–60 fps, and the globe draws within 5.2 s.
- deck.gl 9.4 needs shims on MapLibre v6, draws planes as dots and adds 223 kB. The production globe already draws arcs, aircraft icons and low-power mode.

## Read first

- `docs/overhaul/prototype-report.md` (parity checklist, findings)
- `apps/web/src/features/play/` (`BriefingDrawer.tsx`, `PlayContextCard.tsx`, `cardModels.ts`, `selection.ts`)
- `apps/web/src/routes/-index.lazy.tsx` (home: the live-world intro card and the cockpit toggle)
- `apps/web/src/features/network/components/WorldMap.tsx`, `AirportInfoPanel.tsx`, `AircraftInfoPanel.tsx`
- `packages/map/src/Globe.tsx`, `packages/map/src/interactions.ts`, `packages/map/src/layers/routes.ts`

## In scope

- A briefing drawer on the home map. It replaces the dismissible intro card. Desktop: a side drawer. Phone: a bottom sheet.
- Route arcs on the main globe are clickable and open a route card.
- Airport, aircraft and route cards share one compact card style, with "Open details" into the existing panels.
- Retiring the `/play` prototype and deck.gl once their good parts live in the main shell.

## Out of scope

- Rewriting the full panels: cockpit, fleet, routes, finance and leaderboard stay as they are, reached from cards and the nav.
- New gameplay.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S56.1** Briefing drawer on the home map. It shows cash, routes and planes in the air, the next landing, world events, daily objectives and (for new airlines) the first-hour checklist. It is collapsible and remembered per device. Desktop: a side drawer. Phone: a bottom sheet. _Done when:_ component tests + e2e (en/es) + desktop and phone screenshots.
- [x] **S56.2** Route cards on the main globe. Clicking a route arc opens a card: owner, frequency, distance, profit per day and load factor for your own routes, with doors to fares and frequency. `@acars/map` gains `onRouteSelect`. Hit priority: airport, then aircraft, then route. _Done when:_ map unit tests + component tests + e2e click on an arc.
- [x] **S56.3** One card style. Airport and aircraft inspection become the same compact card over the map (a summary plus "Open details" into the existing panels), and a bottom sheet on phones. _Done when:_ component tests + e2e + phone screenshot.
- [x] **S56.4** Retire the prototype. Remove `/play`, deck.gl and its shim. Port the `?load=N` synthetic-aircraft generator to the main globe, so the perf probe keeps a 10k/50k benchmark; it only rebuilds what changed (see the report's follow-up). _Done when:_ the bundle loses the deck.gl chunk, the perf probe runs on the main globe, and e2e is green.

## Acceptance criteria

- [x] Opening the app shows the world with a briefing, not a panel.
- [x] Tapping anything on the globe explains it in place, with a way to act or dig deeper.
- [x] No deck.gl in the bundle, and the main globe holds the S54 performance budgets.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · brief · e321ee6 · Written after the owner chose option A for D4 (Android re-test: 30–60 fps; globe in 5.2 s).

2026-10-07 · S56.1 · f462d3a · **Briefing drawer on the home map.**

- **What:** `features/briefing/HomeBriefing.tsx` replaces the dismissible "live world" card for players with an airline. It shows the airline, then cash, active routes, planes in the air and the next landing, then the cockpit's own first-hour checklist, daily objectives and world events, and a door into the cockpit. Guests keep their one-button card.
- **Layout:** a drawer beside the nav on desktop (left, so it never covers the map buttons or the airport and aircraft panels on the right). A bottom sheet above the nav on phones, at most 60% of the screen. Folding keeps the four-figure summary; the choice is remembered per device (`acars:home:briefing`). `?panel=map` opens it folded.
- **One copy of each card:** the home route unmounts the briefing while the cockpit is open, so the cockpit's cards are never on screen twice and e2e selectors stay unambiguous. The next-landing countdown has its own tick subscription, so the drawer doesn't re-render every tick. The perf probe stays within the S54 budgets.
- **Tests:** component (summary, cards, fold and memory, folded start, another airline's view, Spanish), home route (when the briefing mounts), e2e desktop (cards, cockpit hand-off, fold across reload, Spanish) and phone (bottom-sheet geometry, fold). Screenshots: [desktop](../media/s56/home-briefing-desktop.png), [phone](../media/s56/home-briefing-phone.png), [phone folded](../media/s56/home-briefing-phone-folded.png).

2026-10-09 · S56.2 · 227c38d · **Route cards on the main globe.**

- **Map (`@acars/map`):**
  - Route features carry their id and endpoints.
  - `resolveMapSelection` falls back to route arcs after airports and aircraft. It uses a 6 px hitbox and prefers your arc over a rival's.
  - `Globe` gains `onRouteSelect`.
  - A small `window.__acarsMapTest` handle (project a coordinate, jump the camera) lets e2e click an arc at a known place.
- **Card (`RouteMapCard`):** clicking an arc opens a card in place: the route, who flies it, flights a week and distance. Your own routes also show profit per flight hour and load factor from the landings so far, the same measure the arc colours use. I didn't invent a per-day figure. Doors lead to the route list (fares and frequency) and to either airport. A bottom sheet on phones. Escape, the X or a click on empty map closes it.
- **Layout fixes found on the way:** the route key hides while the card holds that corner, and the folded briefing shrinks to its summary on desktop instead of stretching down the side.
- **Tests:** map interactions (route fallback, player-first, malformed features), route features (id and endpoints), the test handle, the card (yours, before and after landings; a rival's; an unknown rival; closing; Spanish), and the e2e (`route-card.spec.ts`: launch MAD → BCN, click the arc's midpoint, check the card, follow "Fares & frequency"). Screenshot: [route card](../media/s56/route-card.png).

2026-10-09 · S56.3 · c3235db · **One card style: airports and aircraft answer in place.**

- **Shell:** `MapCard` is the shared card: kicker, title, subtitle, a 2×2 grid of figures and doors. Bottom right on desktop; a solid bottom sheet on phones. It is portaled above the app chrome, so on a phone it covers the folded briefing rather than hiding under it. The route card (S56.2) now uses it too.
- **Airport card:** your routes and aircraft there, whose hub it is (yours, a rival's or nobody's), any world event on now, and "Open details". **Aircraft card:** model and owner, status, route or base, and for a flight how far along it is and when it lands (its own tick subscription), plus "Open details".
- **Behaviour change:** a click on an airport or aircraft no longer jumps to its full panel and URL. It opens the card; "Open details" opens the panel at `/airport/…` or `/aircraft/…`. URLs and the links elsewhere in the app still open the full panels directly. Opening a card closes any full panel (and leaves its URL); one card at a time.
- **Found on the way:**
  - Clicking near Barcelona picked Sabadell: several airports share the 24 px hitbox and the resolver took the first. It now takes the busiest.
  - The briefing only folded on `?panel=map` when it first mounted. It now folds whenever you switch to the map-only view.
- **Tests:** map interactions (busiest airport wins), the airport card (counts, hub lines, event on now, doors, Spanish), the aircraft card (flight progress and landing time, parked rival), `WorldMap` (card first, panel and URL from its door), the briefing (folds on switching view). e2e: `route-card.spec.ts` now also clicks BCN for its card and follows "Open details" to `/airport/BCN`, and `mobile-map-cards.spec.ts` taps Lisbon on a phone for the bottom sheet. Screenshot: [phone airport card](../media/s56/airport-card-phone.png).

2026-10-09 · fix · 94aa936 · **The key-backup prompt no longer vanishes on a revenue dip.** `key-backup-prompt.spec.ts` failed twice in CI (#190 and here): the prompt never appeared after the first landing. I couldn't reproduce it locally, even with 4× CPU throttling, and the CI trace isn't reachable from the session. The cause I found by reading: `KeyBackupPrompt` re-decided whenever `cumulativeRevenue` crossed zero. A sync replaying the airline's own older snapshot can set it back to 0. Showing the prompt marks it as seen, so on the way back up the decision came out "nothing due" and the prompt was gone for good. Now a decision holds for the account until the player closes it or backs the key up. There is a unit test for the dip. If the spec still fails in CI, this wasn't the cause and it needs the CI trace.

2026-10-09 · S56.4 · (this commit) · **Prototype retired.**

- **Removed:** `/play` (route, `features/play/`), its two e2e specs, the deck.gl packages and the `apache-arrow>@types/node` override they needed, the root layout's `/play` special cases and the `play.*` strings. The lockfile loses 394 lines; the build has no deck.gl or prototype chunk.
- **Ported:** `?load=1000|10000|50000` adds synthetic rival traffic to the main globe (`syntheticLoad.ts`). It is built once per load, and only the live rivals are re-joined when they change, which is the report's follow-up about not rebuilding everything every tick. It is a benchmark aid: nothing is simulated and nothing reaches state or relays. `Globe` gains `onReady`, so `?boot=1` now shows "map: globe loaded" for the main shell.
- **Tests:** the generator (loads, leg lengths, determinism, in the air now). The `?boot=1` trace test moved to `smoke.spec.ts`. `perf-probe.spec.ts` gained a 10k run on the main globe: about one map update a second in low-power mode (0.9/s, the same cadence as idle), logged next to the S54 numbers.
- **Report:** `prototype-report.md` notes the outcome and where the knobs went.

## Follow-ups

_None yet._

## Handoff notes

- **Shipped (D4 = A):**
  - A briefing drawer on the home map (S56.1).
  - Route cards from the arcs (S56.2).
  - One card style for routes, airports and aircraft, with doors into the full panels (S56.3).
  - The prototype and deck.gl retired, with the load generator and boot trace ported to the main map (S56.4).
  - Also a fix for the key-backup prompt vanishing on a revenue dip.
- **Behaviour change to know:** a click on an airport or aircraft opens its card, not its full panel. The URL changes only through "Open details" (or links and permalinks, which still open the panels directly).
- **Didn't:** a redesign of the full panels themselves (cockpit, fleet, routes, finance); they are reached from cards and the nav as before.
- **Gotchas:**
  - Map cards are portaled above the app chrome, because the map layer sits under the HUD. Anything new on the map that must cover the briefing needs the same treatment.
  - `window.__acarsMapTest` (project and jumpTo) is how e2e clicks a known place on the globe.
  - `routeTree.gen.ts` regenerates on build in the generator's formatting. Run `biome format` on it before committing a route change.
