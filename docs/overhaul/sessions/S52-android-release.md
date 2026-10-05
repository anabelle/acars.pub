# S52 — Android / Play release readiness

> **Status:** ☐ not started · **Track:** Growth · **Size:** M · **Depends on:** S34, decision D7 · **Unblocks:** — · **Gated by D7**
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Native push via Capacitor if D3 allows.
- A checklist of owner steps in `docs/overhaul/android-release.md`.

## Acceptance criteria

- [ ] The AAB builds in CI; the listing kit is complete.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
