# S42 — Aircraft family icons + livery tint

> **Status:** ◐ in progress
> **Next step:** S42.2
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
>
> **Track:** Graphics · **Size:** M (3 steps) · **Depends on:** S41 · **Unblocks:** S43
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

You can tell a turboprop from a widebody, and your fleet from a rival's, at a glance.

## Why (evidence)

- Audit §2.8: one generic icon for every aircraft.

## Read first

- `packages/map/src/icons.ts`
- `shared/components/FamilySilhouette.tsx`
- `packages/data/src/aircraft.ts` (families)

## In scope

- Icon set per family (turboprop, regional jet, narrowbody, widebody, very-large) as SDF icons for runtime tinting
- Tint with the airline's livery primary; short trail behind moving aircraft; interpolation between ticks

## Out of scope

- 3D models (S45).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S42.1** SDF icon set per aircraft family. _Done when:_ icons render at 3 zooms.
- [ ] **S42.2** Icon-image expression + livery tint. _Done when:_ screenshots.
- [ ] **S42.3** Trails + interpolation. _Done when:_ perf within 10% of S41.

## Details & guidance

- Keep a single symbol layer with an icon-image expression (instancing-friendly).
- Accessibility: shape differs by family, not only color.

## Acceptance criteria

- [ ] Screenshots at 3 zoom levels; perf within 10% of S41.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S42.1 · (this commit) · **Starting point.** Most of the brief already existed before this session (the audit predates it): 12 per-family tar1090 silhouettes in `icons.ts` (5 shape classes: turboprop, regional jet, narrowbody, widebody, very-large), an icon-image `match` on `familyId`, livery tint through `icon-color`, and a 5 Hz interpolation loop. Every catalog family has an icon.

This step fixed what was wrong with the icons:

- **Real SDFs.** The icons were plain 48 px silhouettes flagged `sdf: true`. MapLibre read their hard 0/255 alpha as distance, so they aliased, thinned and blurred when zoomed, and halos had nothing to work with. New pure `sdf.ts` (`alphaToSdf`: TinySDF encoding, a Felzenszwalb distance transform, sub-pixel anti-aliased edges). `registerAircraftIcons` now rasterises each SVG at 2× with a 4 px buffer and uploads a true distance field (`pixelRatio: 2`); logical size and wing-tip offsets are unchanged.
- **Accent fix.** The B787/B777 and A350 accent SVGs used `cy` on `<rect>`, so the detail drew at the top edge; a test now forbids it.
- **Size floor.** One shared `AIRCRAFT_ICON_SIZE` expression replaces five copies (body, accent, lights). It adds a low-zoom floor (0.3 at z2, 0.42 at z5): at zoom 3 the turboprops and narrowbodies had been about 6 px dots under the glow. Above z8, sizing is wingspan-relative as before.
- **Harness.** New e2e `aircraft-icons.spec.ts` serves maplibre from the preview server, replays the real `addFlightLayers` specs with these SDF icons, and draws all 12 families with distinct liveries at zooms 3, 6 and 10. It asserts each family's tint is on screen and saves PNGs with `S42_SCREENSHOT`. Checked by eye: the shapes read by class, edges are crisp at z10, and nav lights sit on the wing tips.
- **Tests.** Unit tests for the SDF (edge value, linear fall-off, Euclidean corners, anti-aliased pixels), SVG resizing, and registration (112 px at 2×, no-context path).

**Re-scope of the remaining steps.** S42.2: tell your fleet from rivals' (halo on your aircraft, tint check) with screenshots. S42.3: trails as an instanced symbol layer on the same sources (no extra features), perf compared with S41.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
