# S44 — Livery as hero + fleet poster

> **Status:** ☐ not started · **Track:** Graphics · **Size:** M · **Depends on:** — · **Unblocks:** S51
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Lazy-load and cache images; fall back to silhouettes.
- en + es.

## Acceptance criteria

- [ ] Screenshots; the poster renders identically at 1080×1350 and 1200×630.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
