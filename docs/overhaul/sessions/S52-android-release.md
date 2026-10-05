# S52 — Android / Play release readiness

> **Status:** ☐ not started
> **Next step:** S52.1
> **Branch:** —
> **PR:** —
>
> **Track:** Growth · **Size:** M (3 steps) · **Depends on:** S34, decision D7 · **Unblocks:** — · **Gated by D7**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Prepare everything needed to ship the existing Capacitor app to Google Play; the owner does the account steps.

## Why (evidence)

- Ledger A22 (unverified store presence); audit T2 (store presence is where competitors get their players).

## Read first

- `apps/web/android/`, `capacitor.config.ts`

## In scope

- CI job building a signed-ready AAB (signing keys come from owner secrets, never committed)
- Store listing kit: screenshots (S01 harness), feature graphic, short and long descriptions (en + es), privacy policy page

## Out of scope

- Creating store accounts or uploading.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S52.1** CI job building the Android AAB (secrets from owner). _Done when:_ AAB artifact in CI.
- [ ] **S52.2** Store listing kit (screenshots, graphics, descriptions en + es, privacy page). _Done when:_ kit complete.
- [ ] **S52.3** `docs/overhaul/android-release.md` owner checklist. _Done when:_ owner can publish.

## Details & guidance

- Native push via Capacitor if D3 allows.
- A checklist of owner steps in `docs/overhaul/android-release.md`.

## Acceptance criteria

- [ ] The AAB builds in CI; the listing kit is complete.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
