# S56 — Globe-first shell on MapLibre (D4 = A)

> **Status:** ◐ in progress
> **Next step:** S56.1
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
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

- [ ] **S56.1** Briefing drawer on the home map. It shows cash, routes and planes in the air, the next landing, world events, daily objectives and (for new airlines) the first-hour checklist. It is collapsible and remembered per device. Desktop: a side drawer. Phone: a bottom sheet. _Done when:_ component tests + e2e (en/es) + desktop and phone screenshots.
- [ ] **S56.2** Route cards on the main globe. Clicking a route arc opens a card: owner, frequency, distance, profit per day and load factor for your own routes, with doors to fares and frequency. `@acars/map` gains `onRouteSelect`. Hit priority: airport, then aircraft, then route. _Done when:_ map unit tests + component tests + e2e click on an arc.
- [ ] **S56.3** One card style. Airport and aircraft inspection become the same compact card over the map (a summary plus "Open details" into the existing panels), and a bottom sheet on phones. _Done when:_ component tests + e2e + phone screenshot.
- [ ] **S56.4** Retire the prototype. Remove `/play`, deck.gl and its shim. Port the `?load=N` synthetic-aircraft generator to the main globe, so the perf probe keeps a 10k/50k benchmark; it only rebuilds what changed (see the report's follow-up). _Done when:_ the bundle loses the deck.gl chunk, the perf probe runs on the main globe, and e2e is green.

## Acceptance criteria

- [ ] Opening the app shows the world with a briefing, not a panel.
- [ ] Tapping anything on the globe explains it in place, with a way to act or dig deeper.
- [ ] No deck.gl in the bundle, and the main globe holds the S54 performance budgets.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · brief · (this commit) · Written after the owner chose option A for D4 (Android re-test: 30–60 fps; globe in 5.2 s).

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
