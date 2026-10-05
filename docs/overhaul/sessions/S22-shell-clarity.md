# S22 — Shell clarity: naming, status bar, real health

> **Status:** ☐ not started
> **Next step:** S22.1
> **Branch:** —
> **PR:** —
>
> **Track:** UX · **Size:** M (3 steps) · **Depends on:** S20 · **Unblocks:** S31
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

One name per place, a status bar that speaks player language, and health indicators that tell the truth.

## Why (evidence)

- Audit U6, U8; ledger A10 (static LIVE DATA).

## Read first

- `layout/Sidebar.tsx`, `Topbar.tsx`, `WorkspaceContextBar.tsx`
- `network/components/Ticker.tsx`
- `cockpit/components/OperationsCockpit.tsx`
- route files under `apps/web/src/routes`

## In scope

- Naming: Cockpit, Fleet, Routes, Rivals, Finance, Info (labels, mobile tabs, page titles); add URL aliases (`/routes`, `/rivals`, `/finance`, `/info`) and redirect old paths
- Ticker: UTC clock, next landing countdown, today's cash delta, "World economy" label, LIVE dot tied to relay health
- Cockpit: relay card only when degraded; rewrite copy in player language

## Out of scope

- Tier progress (S31).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S22.1** Unified names + URL aliases with redirects from old paths. _Done when:_ redirect tests green.
- [ ] **S22.2** Ticker: UTC clock, next landing, cash delta, "World economy", real LIVE health. _Done when:_ LIVE dot amber when relays down.
- [ ] **S22.3** Cockpit: relay card only when degraded + jargon-free copy (en + es). _Done when:_ screenshots.

## Details & guidance

- Keep old URLs working (redirects) so shared links don't break.
- Remove "signed actions", "world tape" and similar jargon from the cockpit strings.
- en + es.

## Acceptance criteria

- [ ] Screenshots; redirect tests; the LIVE dot goes amber with relays stubbed down.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
