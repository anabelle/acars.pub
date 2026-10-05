# S22 — Shell clarity: naming, status bar, real health

> **Status:** ◐ in progress
> **Next step:** S22.2
> **Branch:** claude/zen-darwin-3op878
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

- [x] **S22.1** Unified names + URL aliases with redirects from old paths. _Done when:_ redirect tests green.
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

2026-10-05 · S22.1 · (this commit) · Nav names are now Cockpit, Fleet, Routes, Rivals, Finance, Info on desktop, mobile and page titles (en + es; the separate mobile labels are gone). `/routes`, `/rivals`, `/finance` and `/info` redirect to `/network`, `/leaderboard`, `/corporate` and `/about`, keeping search params (`shared/lib/routeAliases.ts`). The old paths stay canonical, so existing links and tests are unaffected. Unit tests cover the mapping; `e2e/url-aliases.spec.ts` checks every redirect in the browser.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
