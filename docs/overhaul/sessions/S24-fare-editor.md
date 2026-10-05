# S24 — Outcome-first fare editor + RouteManager i18n

> **Status:** ☐ not started · **Track:** UX · **Size:** M · **Depends on:** S23 · **Unblocks:** —
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

## Goal

Pricing shows consequences: projected LF and profit as you type, plus presets.

## Why (evidence)

- Audit §2.5 and U9; ledger A20.

## Read first

- `network/components/RouteManager.tsx` (~L1800–1960 fare editor; opportunities list)

## In scope

- Extract `FareEditor.tsx` and `OpportunitiesList.tsx` from `RouteManager.tsx`
- Live projection via S23's `projectRouteEconomics`
- Presets: Suggested / Aggressive / Premium
- Opportunities: default sort by projected profit/day
- Precise sweep of hard-coded strings → i18n (en + es); add a lint rule (e.g. `i18next/no-literal-string` scoped to `features/**`)

## Out of scope

- Changes to fare validation (S10 owns caps).

## Tasks

- Keep virtualization in the opportunities list (Rule 5).
- Show an "above market" warning band once S10/S11 make it matter.

## Acceptance criteria

- [ ] No literal strings in `RouteManager.tsx` and its new children (lint).
- [ ] Screenshots.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
