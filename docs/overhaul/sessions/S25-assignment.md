# S25 — Assign from both sides + ferry-and-assign

> **Status:** ☐ not started
> **Next step:** S25.1
> **Branch:** —
> **PR:** —
>
> **Track:** UX · **Size:** M (4 steps) · **Depends on:** S23 · **Unblocks:** —
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Put planes on routes from wherever the player is looking.

## Why (evidence)

- Ledger A8: assignment exists only in `FleetManager.tsx`.

## Read first

- `fleet/components/FleetManager.tsx`
- `RouteManager.tsx` active routes
- `network/components/AircraftInfoPanel.tsx`
- `fleetSlice.ferryAircraft`, `networkSlice.assignAircraftToRoute`

## In scope

- "Add aircraft" on route rows/panels; "Assign route" on aircraft panels
- Candidate list filtered to aircraft at a valid endpoint, with "ferry + assign" for others (two actions, one confirm)

## Out of scope

- Changing assignment rules.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S25.1** Shared candidate-aircraft selector (at endpoint / needs ferry). _Done when:_ unit tests.
- [ ] **S25.2** "Add aircraft" from route rows/panel. _Done when:_ screenshots.
- [ ] **S25.3** "Assign route" from aircraft panel + ferry-and-assign. _Done when:_ screenshots.
- [ ] **S25.4** E2E for both entry points. _Done when:_ e2e green.

## Details & guidance

- Reuse the S23 hook's orchestration for multi-action flows.
- en + es.

## Acceptance criteria

- [ ] Assignment possible from route panel, aircraft panel and fleet list; e2e test.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
