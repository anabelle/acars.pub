# S01 — Browser smoke & screenshot tests in CI

> **Status:** ◐ in progress
> **Next step:** S01.5
> **Branch:** claude/zen-darwin-3op878
> **PR:** https://github.com/anabelle/acars.pub/pull/158
>
> **Track:** Foundations · **Size:** M (5 steps) · **Depends on:** — · **Unblocks:** S40, S45 (and every UI session's screenshots)
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Catch blank maps, boot crashes and layout regressions automatically, and give every UI session a one-command way to produce 390 px and 1440 px screenshots.

## Why (evidence)

- The globe was a black canvas on `main` for ~13 days (`238cfae` → `fc6b969`) and CI didn't notice (ledger A14, A15).
- UI sessions need comparable before/after screenshots.

## Read first

- `.github/workflows/ci.yml`
- `apps/web/vite.config.ts`, `apps/web/package.json` (`playwright-core` is already a dev dependency)
- Commit `fc6b969` (why the worker 404'd)

## In scope

- New `apps/web/e2e/` (Playwright test runner config + specs)
- `package.json` scripts: `test:e2e`, `screenshots`
- `.github/workflows/ci.yml`: new job after build

## Out of scope

- Any app code changes. If a test exposes a bug, file a follow-up instead of fixing it here.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S01.1** Playwright config + boot smoke spec for `/` (`pnpm test:e2e`). _Done when:_ spec passes locally against `vite preview`.
- [x] **S01.2** Smoke specs for all routes + same-origin 4xx/5xx check + relay WebSocket stub. _Done when:_ all routes pass without network relays.
- [x] **S01.3** Map non-blank spec + `window.__acarsMap` test hook. _Done when:_ spec fails if you break the MapLibre worker URL locally.
- [x] **S01.4** Mobile overlap spec (`test.fail`, linked to S20) + `pnpm screenshots`. _Done when:_ screenshots written for 390 and 1440.
- [ ] **S01.5** CI job + screenshot artifact upload. _Done when:_ CI green on the PR.

## Details & guidance

- Serve the **built** app (`vite preview`) in the test.
- Smoke spec for `/`, `/join`, `/network`, `/fleet`, `/leaderboard`, `/corporate`, `/about`, `/airport/MAD`: no `pageerror`, no 4xx/5xx for same-origin assets (especially `maplibre/*.mjs`).
- Map spec: wait for the MapLibre `idle` event, read canvas pixels, and assert non-trivial variance, i.e. not a single flat color. If CI has no tile access, also assert airports/arcs layers exist through `map.getLayer` from an exposed test hook (`window.__acarsMap` only when `import.meta.env.MODE === 'test'`).
- Mobile layout spec at 390×844: assert the top bar and `WorkspaceContextBar` bounding boxes don't overlap. Expected to **fail** today (ledger A12). Mark it `test.fail()` with a link to S20, so S20 flips it.
- `pnpm screenshots` writes `artifacts/screenshots/{390,1440}/<route>.png`; CI uploads them as an artifact.
- Relays: stub WebSocket for determinism (guest mode must render without relays).

## Acceptance criteria

- [ ] CI job is green on `main` and red when you locally reintroduce the MapLibre worker 404 (prove it once, describe it in the PR).
- [ ] `pnpm screenshots` works locally and in CI.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

- 2026-10-05 · S01.1 · (this commit) · Added `@playwright/test@1.63.0`, `apps/web/playwright.config.ts` (serves the built app via `vite preview`, `CHROMIUM_PATH` override for local runs), `e2e/smoke.spec.ts` for `/` (waits on `data-app-ready`, asserts no `pageerror`), `e2e/tsconfig.json` chained into `typecheck`, `e2e` added to lint, `pnpm test:e2e` at root and web. Passes locally against `vite preview`.
- 2026-10-05 · S01.2 · (this commit) · `e2e/fixtures.ts`: an in-browser fake relay via `context.routeWebSocket` (answers `REQ` with `EOSE`, `EVENT` with `OK`; verified it intercepts ~74 messages per page, including the auditor worker), plus a `problems` fixture for page errors and same-origin failures. Probing showed `vite preview` serves missing files as `200 text/html` (the SPA fallback, exactly how the Sept worker bug looked), so the check also flags `.js/.mjs/.css/.json/.wasm` responses with an HTML content type; verified it catches `/maplibre/does-not-exist.mjs`. Smoke spec covers 9 routes. Lint override in `eslint.config.js` disables `react-hooks/rules-of-hooks` for e2e files (it misreads Playwright's fixture `use()`).
- 2026-10-05 · S01.3 · (this commit) · `e2e/map.spec.ts` + `offlineBasemap` fixture. **Deviation:** no `window.__acarsMap` hook. The brief rules out app code changes, and a hook gated on `MODE === 'test'` wouldn't exist in the production build under test. Instead the fixture answers the Carto `style.json` with a tiny local style and aborts tiles (hermetic, same result locally and in CI), and the spec hides all overlays, screenshots the map canvas, decodes it in-page and counts distinct quantized colors. Measured at 1440×900: healthy ≈ 36, worker file removed = 4–6, threshold 16. **Acceptance proof:** with `dist/maplibre/maplibre-gl-worker.mjs` removed, the spec fails on both the pixel check (4 < 16) and the asset check (`html-fallback …/maplibre-gl-worker.mjs`); restored, it passes. A first version passed on a broken map because the element screenshot included the intro card drawn over the canvas; fixed by hiding overlays.
- 2026-10-05 · S01.4 · (this commit) · Playwright projects: `desktop` (1440×900), `mobile` (390×844) and an opt-in `screenshots` project. `pnpm test:e2e` runs desktop + mobile. `e2e/mobile-layout.spec.ts` checks the mobile top bar ("Open identity" button) against `WorkspaceContextBar` on `/`, `/?panel=cockpit` and `/join`, marked `test.fail` for S20. Before adding the annotation I confirmed it fails on the real overlap (context bar y 0–38 vs top bar y 12–74), not a missing selector; a first selector version timed out instead, which `test.fail` would have hidden. `pnpm screenshots` (root) writes 18 PNGs to `apps/web/.artifacts/screenshots/{390,1440}/<slug>.png` using the same fake relay and offline basemap. The legacy live-relay QA script (`apps/web` `screenshots`) is untouched. Route list shared in `e2e/routes.ts`.
- 2026-10-05 · S01.5 (WIP) · (this commit) · Added the `e2e` job to `.github/workflows/ci.yml` (parallel to `verify`): install, build, `playwright install --with-deps chromium`, `pnpm test:e2e`, then always `pnpm screenshots` and upload the `screenshots` artifact, plus the Playwright report on failure. **Remaining:** confirm the job is green on PR #158, then tick S01.5 and write the handoff.

## Follow-ups

- `apps/web/src/routeTree.gen.ts` is rewritten (quote style only) by every `vite build`/test run, so the working tree is dirty after any build. Either exclude it from Prettier and commit the generator's format, or configure the router plugin's `quoteStyle`/`semicolons` to match. Small chore, outside S01's scope.

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
