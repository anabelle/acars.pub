# S25 — Assign from both sides + ferry-and-assign

> **Status:** ◐ in progress
> **Next step:** S25.3
> **Branch:** `claude/zen-darwin-3op878`
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

- [x] **S25.1** Shared candidate-aircraft selector (at endpoint / needs ferry). _Done when:_ unit tests.
- [x] **S25.2** "Add aircraft" from route rows/panel. _Done when:_ screenshots.
- [ ] **S25.3** "Assign route" from aircraft panel + ferry-and-assign. _Done when:_ screenshots.
- [ ] **S25.4** E2E for both entry points. _Done when:_ e2e green.

## Details & guidance

- Reuse the S23 hook's orchestration for multi-action flows.
- en + es.

## Acceptance criteria

- [ ] Assignment possible from route panel, aircraft panel and fleet list; e2e test.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S25.1 · (this commit) · `network/utils/assignmentCandidates.ts`:

- `assignmentOption(aircraft, route, hubs, distanceKm)` returns `ready`, `ferry` (to the nearest hub endpoint within range) or `blocked`, with one of 7 reasons. It mirrors the store's rules: not en route, based at a hub that is a route endpoint, in range. A ferry needs an idle aircraft and a ferry leg within range.
- `candidateAircraftForRoute` and `candidateRoutesForAircraft` sort ready (free before reassignments), then ferries by distance, then blocked. Ties break by name.

Design note for S25.3: a ferry puts the aircraft en route, and en-route aircraft can't be assigned. So 'ferry + assign' can't be two back-to-back actions without changing the assignment rules, which is out of scope. Plan: one confirm publishes the ferry now and queues the assignment, which fires when the aircraft lands while the game is open.
2026-10-06 · S25.2 · (this commit) · 'Add aircraft' on every active route row in the route manager. The button is primary when the route has no aircraft. It opens `AssignAircraftDialog`, a virtualized candidate list built from `candidateAircraftForRoute` with `catalogDistanceKm`:

- ready aircraft get a one-tap Assign, which shows a toast and closes the dialog;
- ferry candidates show the leg needed (the action comes in S25.3);
- blocked ones explain why.

en and es strings are in `assign.*`, with unit tests for the dialog. New e2e `route-assign.spec.ts` launches MAD→BCN and MAD→LIS, then moves an aircraft from the route list. It passes locally, and I checked a desktop screenshot of the dialog by eye. The airport panel's route chips are navigation only, so the route list is the route-side entry point.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
