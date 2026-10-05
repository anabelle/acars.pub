# S23 — Route projection + airport decision card + one-click launch

> **Status:** ☐ not started · **Track:** UX · **Size:** L · **Depends on:** — · **Unblocks:** S24, S25, S26, S43
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Unit-test the projection against S02 harness numbers (same inputs, same outputs).
- Recommended aircraft = cheapest in-range model that the projection says is profitable.
- If any step fails, show exactly what succeeded and offer "finish setup".
- en + es.

## Acceptance criteria

- [ ] From a fresh airline: airport click → flying in ≤ 2 clicks + 1 confirm (e2e test via S01 harness with stubbed relays).

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
