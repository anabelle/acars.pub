# S60 — Livery-first plane panel and the hangar as a collection

> **Status:** ◐ in progress
> **Next step:** S60.1
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
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

- [ ] **S60.1** Plane panel: hero, sign, flight strip, day strip, graceful fallback; en/es. _Done when:_ component tests (hero/fallback/strip) + e2e with the stubbed painting + 1440/390 screenshots.
- [ ] **S60.2** Hangar collection: livery cards, top earner, idle with one-tap fix; virtualized. _Done when:_ component tests (top earner, idle, fix) + e2e + screenshots.
- [ ] **S60.3** Contrast fixes, audit e2e, PR with before/after screenshots; ready when CI is green.

## Acceptance criteria

- [ ] Opening a plane shows its painting first, at full panel width, at 1440 and 390.
- [ ] No raw error text from livery generation reaches the screen.
- [ ] The flight reads origin → destination with UTC times and progress without opening a tab.
- [ ] The hangar shows top earner and idle planes at a glance, and idle is one tap from fixed.
- [ ] Clipped-control audit, perf probes and the full e2e suite stay green.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-11 · brief · (this commit) · Written after a before-capture of the plane panel and fleet (desktop and phone).
