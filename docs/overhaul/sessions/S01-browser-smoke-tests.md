# S01 — Browser smoke & screenshot tests in CI

> **Status:** ☐ not started · **Track:** Foundations · **Size:** M · **Depends on:** — · **Unblocks:** S40, S45 (and every UI session's screenshots)
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Serve the **built** app (`vite preview`) in the test.
- Smoke spec for `/`, `/join`, `/network`, `/fleet`, `/leaderboard`, `/corporate`, `/about`, `/airport/MAD`: no `pageerror`, no 4xx/5xx for same-origin assets (especially `maplibre/*.mjs`).
- Map spec: wait for the MapLibre `idle` event, read canvas pixels, and assert non-trivial variance, i.e. not a single flat color. If CI has no tile access, also assert airports/arcs layers exist through `map.getLayer` from an exposed test hook (`window.__acarsMap` only when `import.meta.env.MODE === 'test'`).
- Mobile layout spec at 390×844: assert the top bar and `WorkspaceContextBar` bounding boxes don't overlap. Expected to **fail** today (ledger A12). Mark it `test.fail()` with a link to S20, so S20 flips it.
- `pnpm screenshots` writes `artifacts/screenshots/{390,1440}/<route>.png`; CI uploads them as an artifact.
- Relays: stub WebSocket for determinism (guest mode must render without relays).

## Acceptance criteria

- [ ] CI job is green on `main` and red when you locally reintroduce the MapLibre worker 404 (prove it once, describe it in the PR).
- [ ] `pnpm screenshots` works locally and in CI.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
