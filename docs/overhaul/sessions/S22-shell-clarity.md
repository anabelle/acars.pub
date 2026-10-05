# S22 — Shell clarity: naming, status bar, real health

> **Status:** ☐ not started · **Track:** UX · **Size:** M · **Depends on:** S20 · **Unblocks:** S31
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Keep old URLs working (redirects) so shared links don't break.
- Remove "signed actions", "world tape" and similar jargon from the cockpit strings.
- en + es.

## Acceptance criteria

- [ ] Screenshots; redirect tests; the LIVE dot goes amber with relays stubbed down.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
