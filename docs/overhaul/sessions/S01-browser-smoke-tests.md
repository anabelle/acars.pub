# S01 — Browser smoke & screenshot tests in CI

> **Status:** ◐ in progress
> **Next step:** S01.2
> **Branch:** claude/zen-darwin-3op878
> **PR:** —
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
- [ ] **S01.2** Smoke specs for all routes + same-origin 4xx/5xx check + relay WebSocket stub. _Done when:_ all routes pass without network relays.
- [ ] **S01.3** Map non-blank spec + `window.__acarsMap` test hook. _Done when:_ spec fails if you break the MapLibre worker URL locally.
- [ ] **S01.4** Mobile overlap spec (`test.fail`, linked to S20) + `pnpm screenshots`. _Done when:_ screenshots written for 390 and 1440.
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

## Follow-ups

- `apps/web/src/routeTree.gen.ts` is rewritten (quote style only) by every `vite build`/test run, so the working tree is dirty after any build. Either exclude it from Prettier and commit the generator's format, or configure the router plugin's `quoteStyle`/`semicolons` to match. Small chore, outside S01's scope.

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
