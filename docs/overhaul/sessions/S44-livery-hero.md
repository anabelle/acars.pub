# S44 — Livery as hero + fleet poster

> **Status:** ◐ in progress
> **Next step:** S44.3
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
- [ ] **S44.3** Fleet poster renderer + PNG download (1080×1350, 1200×630). _Done when:_ posters render identically.

## Details & guidance

- Lazy-load and cache images; fall back to silhouettes.
- en + es.

## Acceptance criteria

- [ ] Screenshots; the poster renders identically at 1080×1350 and 1200×630.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S44.1 · (this commit) · New `shared/components/LiveryThumb.tsx`: a lazy `<img>` of the aircraft's published `liveryImageUrl`. On no image or a load error it falls back to the family silhouette on a 30% tint of the airline colour; tinting the background keeps dark liveries visible. It never triggers AI generation, so it's safe for long lists and rival aircraft. Used in:

- both flight boards: airport FIDS and airline board (rows now carry `liveryImageUrl` and `familyId`);
- route rows in the route manager: a stack of up to 4 assigned aircraft;
- the aircraft panel's 'Other aircraft on route' list.

Tests: unit tests, plus e2e `liveries.spec.ts` (route row stack with the silhouette fallback). I checked a screenshot by eye.
2026-10-06 · S44.2 · (this commit) · Hangar gallery. The fleet header has a List / Hangar toggle. `HangarGallery` is a row-virtualized grid in the panel scroller, 2 columns on mobile and 3 from 640 px. Each tile shows the aircraft's livery via `LiveryThumb` in a new `fill` size (large silhouette fallback), with the aircraft name and its route or 'Parked at XXX'. Clicking a tile opens the aircraft panel. en and es strings are in `fleet.hangar.*`. Unit tests; the e2e `liveries.spec.ts` now also opens the hangar. I checked a screenshot by eye.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
