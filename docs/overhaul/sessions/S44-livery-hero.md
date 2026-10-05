# S44 — Livery as hero + fleet poster

> **Status:** ☐ not started
> **Next step:** S44.1
> **Branch:** —
> **PR:** —
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

- [ ] **S44.1** Livery thumbnails in aircraft/route panels and flight board. _Done when:_ screenshots.
- [ ] **S44.2** Virtualized hangar gallery. _Done when:_ screenshots.
- [ ] **S44.3** Fleet poster renderer + PNG download (1080×1350, 1200×630). _Done when:_ posters render identically.

## Details & guidance

- Lazy-load and cache images; fall back to silhouettes.
- en + es.

## Acceptance criteria

- [ ] Screenshots; the poster renders identically at 1080×1350 and 1200×630.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
