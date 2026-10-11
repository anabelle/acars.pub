# S59 — Cockpit + Ramp foundation: tokens, fonts, textures, kit; retire neon

> **Status:** ◐ in progress
> **Next step:** S59.2
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
>
> **Track:** Graphics · **Size:** M (4 steps) · **Depends on:** D17 ✅ · **Unblocks:** S60, S62, S63, S65 · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §8, Wave A
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Every later screen composes the same pieces instead of restyling. Ship the Cockpit + Ramp language once (tokens, fonts, textures, a small kit) and retire the neon/glass look everywhere, **without changing any layout**.

## Why

- Owner, 2026-10-10: the "old LLM neon look" must go; chose Cockpit + Ramp, softened ("texture, readability").
- Today: shadcn's default slate/green theme, 77 `backdrop-blur` uses and coloured glows (`shadow-[0_0_20px_rgba(16,185,129,…)]`), system fonts.

## Read first

- `docs/overhaul/BLUEPRINT.md` §8 (rules and tokens: the single source of truth for values)
- `apps/web/src/index.css`, `apps/web/tailwind.config.js`, `apps/web/index.html` (CSP allows only `'self'` fonts plus Google)
- `docs/overhaul/media/s57/ux-audit.spec.ts.txt` (the clipped-control audit to promote)

## In scope

- **Tokens** as CSS variables and Tailwind colours: `cockpit-{bg,panel,line}`, `nd-{magenta,cyan,green,amber,red,white}`, `ramp-{asphalt,slab,paint}`, `sign-{yellow,black,red}`, `hi-vis`.
- **Fonts** self-hosted with `@fontsource` (offline PWA, CSP `'self'`): B612 400/700, B612 Mono 400/700, Overpass 700/800. Tailwind `font-sans` = B612, `font-mono` = B612 Mono, `font-sign` = Overpass.
- **Textures**: asphalt and slab grain tiles (≈3–5 KB JPEG each, from the approved mockups) in `public/textures/`; utilities `.ramp-ground`, `.ramp-slab`.
- **Global re-theme**: shadcn variables remapped to the new palette (background, card, primary = sign-yellow on sign-black, ring = cyan, destructive = red); glows and backdrop blur removed (panels become opaque, flat, hairline borders). Layouts untouched.
- **Kit** (`apps/web/src/shared/ui/ramp`, `apps/web/src/shared/ui/cockpit`): `Sign` (location / direction / mandatory), `Slab`, `PaxCrowd` (pictograms, one figure = N people, seeded and deterministic), `Readout` (boxed figure), `AlertList` (airliner-style messages), `DayStrip` (a plane's day as legs). Unit tests; reduced motion respected.
- **Audit e2e** promoted to `apps/web/e2e/ux-audit.spec.ts` (clipped controls on desktop 1440 and phone 390).

## Out of scope

- New layouts or screens (S60 plane panel and hangar, S62 Today, S63 passengers).
- Map restyle as a navigation display (S60/S62 with the plane panel).

## Steps (checkpoints)

- [x] **S59.1** Tokens, fonts, textures (additive: nothing changes on screen yet). _Done when:_ fonts load from `'self'` offline, Tailwind classes compile, gate green.
- [ ] **S59.2** Global re-theme: palette remap, B612 body, no glows, no blur. _Done when:_ before/after screenshots of home, network, fleet, cockpit at 1440 and 390; 4.5:1 text contrast on the new surfaces; e2e and perf probes green.
- [ ] **S59.3** Kit: `Sign`, `Slab`, `PaxCrowd`, `Readout`, `AlertList`, `DayStrip` with unit tests. _Done when:_ tests cover variants, determinism (same seed, same crowd) and accessibility labels.
- [ ] **S59.4** Promote the clipped-control audit to a permanent e2e; final screenshots; PR ready. _Done when:_ audit green on desktop and mobile, CI green.

## Acceptance criteria

- [ ] No `backdrop-blur` and no coloured glow shadows left in `apps/web/src`.
- [ ] Every text/background pair used by the theme meets 4.5:1.
- [ ] Fonts and textures work offline (no third-party requests).
- [ ] No layout shifts in the existing e2e suite (it stays green unchanged, except selectors tied to removed glows).

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-11 · brief · (this commit) · Written from Blueprint v2 §8 (D17 decided 2026-10-10).

2026-10-11 · S59.1 · (this commit) · **Tokens, fonts, textures (additive; nothing changes on screen yet).**

- CSS variables in `apps/web/src/index.css` (RGB channels) and Tailwind colours `cockpit-*`, `nd-*`, `ramp-*`, `sign-*`, `hi-vis`; the same values in `src/shared/theme/tokens.ts` for MapLibre and canvas, with a test that keeps both in sync and checks 4.5:1 on every text pair.
- Fonts self-hosted via `@fontsource` (latin subsets, ~107 KB woff2 total, hashed into `/assets/`, cached by the service worker): B612 400/700, B612 Mono 400/700, Overpass 700/800. Tailwind families `font-avionics`, `font-avionics-mono`, `font-sign`; `sans`/`mono` switch in S59.2.
- Grain tiles (200 px JPEG, 4.8 KB and 3.1 KB, from the approved mockups) in `src/assets/textures/`, used by `.ramp-ground` and `.ramp-slab`.
