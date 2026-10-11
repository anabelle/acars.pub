# S60 — Livery-first plane panel and the hangar as a collection

> **Status:** ☑ done (awaiting merge)
> **Next step:** — (merge #198)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #198
>
> **Track:** Graphics/UX · **Size:** M (3 steps) · **Depends on:** S59 · **Unblocks:** S61, S63, S65 · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §4, §6 Pride, §8
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

A plane is the thing players love: open it and its painting fills the top, with its flight read like Flightradar24 (codes, UTC times, progress, speed). The hangar becomes a collection of those paintings, each telling at a glance whether the plane earns or sits idle.

## Why (evidence)

- Owner, 2026-10-10: "you criticized us not using the beautiful livery images we generate"; "a super triumph aspect to collect the planes with love".
- Before (S60 capture, 2026-10-11): the panel opens on a small header and a 128 px image; when generation fails it prints the raw error ("HTTP 404 (/api/generate-livery)") in red; the flight is a small strip under tabs; the fleet card hides its base hub and count badge (contrast regressions after S59).

## Read first

- `apps/web/src/features/network/components/AircraftInfoPanel.tsx` (header 520–600, hero 568–585, `FlightStrip` 341–404)
- `apps/web/src/features/fleet/components/AircraftLiveryImage.tsx`, `hooks/useAircraftImage.ts`
- `apps/web/src/features/fleet/components/HangarGallery.tsx` (virtualized tiles, S44)
- `apps/web/src/shared/ui/{ramp,cockpit}` (S59 kit), `packages/core/src/cycle.ts` (`scheduledRoundTripTicks`)

## In scope

- **Plane panel (S60.1)**: hero first (16:9, full width, `object-cover`), the plane's name on a location sign over the painting, type and airline under it; a flight strip like a flight tracker: big origin/destination codes, scheduled departure and ETA in UTC, a magenta progress line, ground speed and distance left as readouts; today's legs as a `DayStrip` in the airline's colour with block hours. Info/Route tabs stay below, unchanged.
- **Livery fallback**: no raw errors on screen. While painting: "Painting the livery…"; on failure or no image: the family silhouette on a slab tinted with the airline's colours. Errors go to the console only.
- **Hangar (S60.2)**: tiles become livery cards (`Slab`): stand label, painting, name in Overpass caps, type, today's `DayStrip`, status line, block hours today; **top earner** (best 7-day profit, sign-yellow edge) and **idle** (hi-vis edge, under 6 block h) with the S58 one-tap "fly more". Stays virtualized.
- **Contrast fixes** found in the before capture (fleet count badge, base hub).
- **e2e**: a `stubLivery` helper serves a test painting for `/api/generate-livery` (the game's own catalog A220 image, so screenshots show a real painting); specs for the panel hero, flight strip, fallback, hangar cards and the idle fix.

## Out of scope

- Naming ceremony, delivery day, logbook, spotter's book (S61); passengers in the cabin (S63); ACARS messages (S65); the map as a navigation display.

## Steps (checkpoints)

- [x] **S60.1** Plane panel: hero, sign, flight strip, day strip, graceful fallback; en/es. _Done when:_ component tests (hero/fallback/strip) + e2e with the stubbed painting + 1440/390 screenshots.
- [x] **S60.2** Hangar collection: livery cards, top earner, idle with one-tap fix; virtualized. _Done when:_ component tests (top earner, idle, fix) + e2e + screenshots.
- [x] **S60.3** Contrast fixes, audit e2e, PR with before/after screenshots; ready when CI is green.

## Acceptance criteria

- [x] Opening a plane shows its painting first, at full panel width, at 1440 and 390.
- [x] No raw error text from livery generation reaches the screen.
- [x] The flight reads origin → destination with UTC times and progress without opening a tab.
- [x] The hangar shows top earner and idle planes at a glance, and idle is one tap from fixed.
- [x] Clipped-control audit, perf probes and the full e2e suite stay green.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-11 · brief · (this commit) · Written after a before-capture of the plane panel and fleet (desktop and phone).

2026-10-11 · S60.1 · (this commit) · **A plane opens on its painting and reads its flight like a tracker.**

- **Hero** (`AircraftInfoPanel`): the painting first (16:9, full width), the plane's name on a location sign over it, type and airline under it, close in the corner. Model labels no longer repeat the maker ("ATR 42-600", not "ATR ATR 42-600").
- **Flight strip** above the tabs: big origin/destination codes with cities, STD and ETA in UTC, a magenta progress bar (`role=progressbar`), and readouts for ground speed, distance to go (from the route when the flight has none) and time left.
- **Last 24 h** strip (`DayStrip`): legs from the plane's landings plus the one in the air (`summarizeFleetDays`, one pass over the timeline, re-scanned per game minute), in the airline's colour or, when it is too dark to read (dark navy is common), its secondary or magenta (`legibleLiveryColour`). A rolling day, so it never looks empty just after midnight UTC.
- **No raw errors**: `AircraftLiveryImage` shows `LiveryFallback` (the family silhouette in the airline's colours on a cockpit panel) with a "Painting the livery…" caption while generating; failures stay in the console.
- **Placement**: floating panels anchor below the real top chrome (`--hud-top`, measured by `useHudTopVar`), so a banner can no longer push the bars over the painting and the close button on desktop. Known: on phones the dismissible key-backup banner still overlays the top of panels (pre-existing).
- **Tests**: panel (hero, strip above the tabs), livery image (painting, no error text, caption), `planeDay`, `livery` helpers; e2e `plane-panel` on desktop and phone with `stubLivery` (serves the catalog A220 photo for `/api/generate-livery`; the e2e plane is an ATR, so the shot shows a stand-in painting). Web unit 603/603; audit and route-assign e2e green.
- Screenshots: [`before-plane-1440`](../media/s60/before-plane-1440.png) → [`after-plane-1440`](../media/s60/after-plane-1440.png); [`before-plane-390`](../media/s60/before-plane-390.png) → [`after-plane-390`](../media/s60/after-plane-390.png).

2026-10-11 · S60.2 · (this commit) · **The hangar is a collection.**

- `HangarGallery` tiles become livery cards on slabs: the painting (via `AircraftLiveryImage`, so a freshly painted plane shows before its upload), a stand number, the name in Overpass caps, the type, the last 24 h `DayStrip`, route, block hours and 7-day profit.
- **Top earner** (best positive 7-day profit, `topEarnerId`): sign-yellow edge and a "Top earner" sign. **Idle**: hi-vis edge; parked planes get "Put it to work" (opens the plane, where it can be assigned), underused ones get the S58 "Fly more · N/wk" (`useRouteUtilization`, only when the suggestion raises the frequency).
- Still virtualized by row (1 column on phones, 2 wider); `summarizeFleetDays` is one pass over the timeline per game minute; the per-card suggestion runs only for rendered cards.
- Tests: hangar (top earner, 24 h strip, parked → put to work, underused → fly more), e2e hangar card with the painting on desktop and phone. Screenshots: [`after-hangar-1440`](../media/s60/after-hangar-1440.png), [`after-hangar-390`](../media/s60/after-hangar-390.png).

2026-10-11 · S60.3 · (this commit) · **Contrast fixes; S60 complete.**

- `text-accent` was used as a highlight colour in five places (fleet count badge, base hub, two opportunity figures, a route figure) but `accent` is a dark surface colour, so they were near-invisible (before S59 too). They now use the cyan highlight (`text-primary`).
- Checks: web unit 606/606, lint, typecheck; e2e plane panel + hangar (desktop and phone), clipped-control audit (desktop and phone), liveries spec green locally. Full e2e in CI.
