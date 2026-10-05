# S23 — Route projection + airport decision card + one-click launch

> **Status:** ☐ not started
> **Next step:** S23.1
> **Branch:** —
> **PR:** —
>
> **Track:** UX · **Size:** L (5 steps) · **Depends on:** — · **Unblocks:** S24, S25, S26, S43
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Clicking an airport answers "is a route here worth it?" and one button gets a plane flying.

## Why (evidence)

- Ledger A8 (5 screens / 3 actions), audit U7, U9.

## Read first

- `network/components/AirportInfoPanel.tsx`
- `network/utils/routeEconomics.ts`
- `store` slices: `openRoute`, `purchaseAircraft`, `assignAircraftToRoute`
- `FlightEngine.estimateLandingFinancials`

## In scope

- `projectRouteEconomics({origin, destination, aircraftModel, fares, tick, competitors})` as a pure function that **calls the same engine functions** (so it follows ruleset changes automatically); returns LF, pax/flight, profit/flight, profit/day and competitor shares
- `useLaunchRoute` hook: open route → lease (or use an idle aircraft at the hub) → assign, with one confirm, progress UI and partial-failure handling
- Airport panel redesign: decision card first, atlas facts collapsed

## Out of scope

- Fare editor (S24)
- Fleet assignment UI (S25)

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S23.1** `projectRouteEconomics` pure function + tests against engine outputs. _Done when:_ matches S02 numbers (or direct engine runs).
- [ ] **S23.2** Airport panel decision card (read-only projection; atlas facts collapsed). _Done when:_ screenshots.
- [ ] **S23.3** `useLaunchRoute` orchestration (open → lease/use idle → assign) + partial-failure handling + tests. _Done when:_ unit tests green.
- [ ] **S23.4** Launch button + recommended aircraft wired into the panel. _Done when:_ manual run: flying in ≤ 2 clicks + 1 confirm.
- [ ] **S23.5** E2E test of the launch flow (S01 harness, stubbed relays). _Done when:_ e2e green.

## Details & guidance

- Unit-test the projection against S02 harness numbers (same inputs, same outputs).
- Recommended aircraft = cheapest in-range model that the projection says is profitable.
- If any step fails, show exactly what succeeded and offer "finish setup".
- en + es.

## Acceptance criteria

- [ ] From a fresh airline: airport click → flying in ≤ 2 clicks + 1 confirm (e2e test via S01 harness with stubbed relays).

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
