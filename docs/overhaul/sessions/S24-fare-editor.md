# S24 — Outcome-first fare editor + RouteManager i18n

> **Status:** ◐ in progress
> **Next step:** S24.2
> **Branch:** claude/zen-darwin-3op878
> **PR:** —
>
> **Track:** UX · **Size:** M (4 steps) · **Depends on:** S23 · **Unblocks:** —
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

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

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S24.1** Extract `FareEditor.tsx` (no behavior change). _Done when:_ tests green.
- [ ] **S24.2** Live projection + Suggested/Aggressive/Premium presets. _Done when:_ screenshots.
- [ ] **S24.3** Extract `OpportunitiesList.tsx`; default sort by projected profit/day (still virtualized). _Done when:_ tests green.
- [ ] **S24.4** i18n sweep (en + es) + literal-string lint rule for `features/network`. _Done when:_ lint green.

## Details & guidance

- Keep virtualization in the opportunities list (Rule 5).
- Show an "above market" warning band once S10/S11 make it matter.

## Acceptance criteria

- [ ] No literal strings in `RouteManager.tsx` and its new children (lint).
- [ ] Screenshots.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-05 · S24.1 · (this commit) · The fare modal is now `network/components/FareEditor.tsx`. It owns its inputs, error, saving state, elasticity and revenue-projection math, and the save call; it seeds its inputs from the route's current fares and takes `{ target, onClose }`. Tone, parse and elasticity helpers shared with the route list moved to `network/utils/fareTones.ts`. `RouteManager.tsx` dropped from 2,100 to 1,518 lines. Behaviour is unchanged (copy still hard-coded; S24.4 sweeps it). New `FareEditor.test.tsx` covers seeding, use-suggested, saving and the empty-input error.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
