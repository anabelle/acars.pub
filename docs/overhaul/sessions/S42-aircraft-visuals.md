# S42 — Aircraft family icons + livery tint

> **Status:** ☑ ready for review
> **Next step:** — (awaiting merge of #179)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #179
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
- [x] **S42.2** Icon-image expression + livery tint. _Done when:_ screenshots.
- [x] **S42.3** Trails + interpolation. _Done when:_ perf within 10% of S41.

## Details & guidance

- Keep a single symbol layer with an icon-image expression (instancing-friendly).
- Accessibility: shape differs by family, not only color.

## Acceptance criteria

- [x] Screenshots at 3 zoom levels; perf within 10% of S41 (relative, software GL; see S42.3).

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

2026-10-06 · S42.2 · (this commit) · **Your fleet vs rivals.** Your aircraft now carry an outline in a new theme colour, `flights.playerHalo` (near-white on the dark globe, navy on earth); rivals' don't. Before, the only cues were size (1.1 vs 0.8), opacity and a glow, and they failed when a rival flew a similar livery.

- **Halo width.** It scales with icon size (`iconSizeExpression(2.6)`). A fixed width overflowed the distance field on small icons and filled their whole square.
- **Expression refactor.** The size expression became `iconSizeExpression(factor)` (one source for size and halo).
- **Harness.** A second scene gives player and rival aircraft identical liveries at zoom 6. It asserts the outline is present on yours (>150 light pixels) and absent on theirs (<10%), and saves `player-vs-rivals.png`; I checked it by eye.
- **Tests.** Halo colour per theme, no halo on rival layers, and one size expression shared by the aircraft and light layers.

2026-10-06 · S42.3 · (this commit) · **Trails.** New `trail.ts`: `buildContrailImage` is a white gradient that is narrow and strongest at the tail, then widens and fades. A symbol layer on each flight source (`flight-trail`, `global-flight-trail`) draws it under the aircraft: anchored at its top, offset to the tail (`TRAIL_TAIL_OFFSET`), rotated with the bearing, sized with `AIRCRAFT_ICON_SIZE`. It fades in from zoom 4, at opacity 0.4 behind yours and 0.22 behind rivals'. There are no extra features and no per-frame JS; the world toggle hides rival trails (`WORLD_LAYER_IDS`).

- **Interpolation.** This already existed: positions are interpolated between ticks at 5 Hz from the engine clock's sub-tick progress (pre-S42).
- **Harness.** A trails scene (`trails-z6.png`; asserts contrail pixels at z6 and none below z4) and an opt-in perf scene (`S42_PERF=1`): 10k rival aircraft re-uploaded at 5 Hz, trails on and off, alternated over 6 rounds.

**Means, software GL, no GPU (relative numbers only, as in S40/S41):**

| Trails | fps  | p95 frame | JS (ms/s) |
| ------ | ---- | --------- | --------- |
| Off    | 18.3 | 111 ms    | 240       |
| On     | 16.6 | 111 ms    | 258       |

- **Result.** p95 frame time is unchanged, JS +7.5% and fps −9%: within the 10% budget.
- **Checks.** The app's own `map.spec` still passes. Tests cover the contrail image (fade, widening, soft edges) and the trail layers (source, minzoom, anchor, offset, size, player stronger, world toggle).

## Follow-ups

- **Rival trails at continent zoom.** They cost about 7% JS at 10k aircraft. If a real device shows strain, give `global-flight-trail` a higher minzoom (e.g. 6) than the player's; at zoom 4–5 they're mostly visual noise.
- **Per-aircraft update cost.** The S40 follow-up still applies (about 50 ms per 5 Hz update at 10k). This session added no per-aircraft JS.

## Handoff notes

- **Shipped.**
  - True SDF aircraft icons (crisp at every zoom), a low-zoom size floor and two accent SVG fixes.
  - An outline on your aircraft (theme-aware), with livery tints for everyone.
  - Contrail trails as instanced symbols.
  - An e2e icon harness: every family at 3 zooms, player vs rivals, trails, and opt-in perf.
- **Already existed (audit predated it).** Per-family silhouettes, livery tint, interpolation.
- **Gotchas.**
  - The SDF halo width must scale with icon size; a fixed width fills small icons' squares.
  - TinySDF distances run centre to centre, so a hard edge pixel encodes at 191 ± 32, not 191.
  - The harness serves maplibre's ESM from `node_modules` through Playwright routing and reuses the app's `/maplibre/` worker copy, so it needs the built preview server like the other specs.
  - Vitest's `node` environment hangs in apps/web (S50); the map package's node environment is fine.
