# S44 — Livery as hero + fleet poster

> **Status:** ☑ merged
> **Next step:** — (merged in #177)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #177
>
> **Track:** Graphics · **Size:** M (3 steps) · **Depends on:** — · **Unblocks:** S51
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Put the unique AI liveries front and center, and make them shareable.

## Why (evidence)

- Audit §2.8: AI liveries (`functions/api/generate-livery.ts`) are hidden in fleet details.

## Read first

- `fleet/components/AircraftLiveryImage.tsx`, `CatalogImage.tsx`
- `fleet/services/aircraftImageService.ts`
- `functions/api/generate-livery.ts`

## In scope

- Hangar gallery view (virtualized grid)
- Livery thumbnails in the aircraft panel, route panel and flight board
- "Fleet poster" image (canvas render: livery grid + airline name + stats) downloadable as PNG

## Out of scope

- Posting to social (S51).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S44.1** Livery thumbnails in aircraft/route panels and flight board. _Done when:_ screenshots.
- [x] **S44.2** Virtualized hangar gallery. _Done when:_ screenshots.
- [x] **S44.3** Fleet poster renderer + PNG download (1080×1350, 1200×630). _Done when:_ posters render identically.

## Details & guidance

- Lazy-load and cache images; fall back to silhouettes.
- en + es.

## Acceptance criteria

- [x] Screenshots; the poster renders identically at 1080×1350 and 1200×630.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S44.1 · (this commit) · New `shared/components/LiveryThumb.tsx`: a lazy `<img>` of the aircraft's published `liveryImageUrl`. On no image or a load error it falls back to the family silhouette on a 30% tint of the airline colour; tinting the background keeps dark liveries visible. It never triggers AI generation, so it's safe for long lists and rival aircraft. Used in:

- both flight boards: airport FIDS and airline board (rows now carry `liveryImageUrl` and `familyId`);
- route rows in the route manager: a stack of up to 4 assigned aircraft;
- the aircraft panel's 'Other aircraft on route' list.

Tests: unit tests, plus e2e `liveries.spec.ts` (route row stack with the silhouette fallback). I checked a screenshot by eye.
2026-10-06 · S44.2 · (this commit) · Hangar gallery. The fleet header has a List / Hangar toggle. `HangarGallery` is a row-virtualized grid in the panel scroller, 2 columns on mobile and 3 from 640 px. Each tile shows the aircraft's livery via `LiveryThumb` in a new `fill` size (large silhouette fallback), with the aircraft name and its route or 'Parked at XXX'. Clicking a tile opens the aircraft panel. en and es strings are in `fleet.hangar.*`. Unit tests; the e2e `liveries.spec.ts` now also opens the hangar. I checked a screenshot by eye.
2026-10-06 · S44.3 · (this commit) · Fleet poster:

- **Layout and drawing.** `fleetPoster.ts` has a pure `layoutFleetPoster` (portrait 1080×1350 as a 3×3 grid, landscape 1200×630 as a 4×2 grid). The header band is derived from title → ICAO → stats, so nothing overlaps. `drawFleetPoster` uses only the layout: airline-colour band, name, ICAO, stats (aircraft, active routes, tier), livery tiles (cover-cropped images, liveried aircraft first, a tinted ✈ when there's none), captions and a footer.
- **Images and export.** `loadPosterImages` loads with CORS (crossOrigin "anonymous"), so a missing or failed image never taints the canvas. `FleetPosterDialog` (opened from Hangar → 'Fleet poster') has a size toggle, a live canvas preview and 'Download PNG' (`<airline>-fleet-WxH.png`). Export failures show a toast.
- **Tests.** Unit tests cover layout bounds, no header overlap, identical draw calls on repeat renders at both sizes, cover cropping, image loading and download. The e2e renders the portrait poster, switches to landscape and back, and checks the PNG data URL is identical; it also checks the download filename. I looked at screenshots of both sizes.
- **i18n.** en and es strings are in `fleet.poster.*`.

## Follow-ups

_None yet._

## Handoff notes

- **Shipped.**
  - `LiveryThumb` (published livery, or a tinted silhouette) on the flight boards, route rows and the aircraft panel.
  - The virtualized Hangar gallery.
  - The fleet poster (two sizes, deterministic, PNG download).
- **Not done (by design).** Posting to social is S51.
- **Gotchas.**
  - Livery URLs come from Blossom hosts. Those without CORS headers fail to load for the poster and fall back to tiles, which keeps export safe.
  - jsdom drops 8-digit hex colours, so tints are built as `rgba()`.
