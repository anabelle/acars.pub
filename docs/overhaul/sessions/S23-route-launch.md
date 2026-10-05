# S23 — Route projection + airport decision card + one-click launch

> **Status:** ◐ in progress
> **Next step:** S23.4
> **Branch:** claude/zen-darwin-3op878
> **PR:** https://github.com/anabelle/acars.pub/pull/160 (S23.1–S23.2 + fuel fix, merged); S23.3+ in a new PR
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

- [x] **S23.1** `projectRouteEconomics` pure function + tests against engine outputs. _Done when:_ matches S02 numbers (or direct engine runs).
- [x] **S23.2** Airport panel decision card (read-only projection; atlas facts collapsed). _Done when:_ screenshots.
- [x] **S23.3** `useLaunchRoute` orchestration (open → lease/use idle → assign) + partial-failure handling + tests. _Done when:_ unit tests green.
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

- 2026-10-05 · S23.1 · (this commit) · **Engine refactor, behavior-neutral:** extracted the per-landing passenger math from `processFlightEngine` into exported `computeFlightPassengers()` (demand, price-war stimulation, QSI allocation, supply pressure, elasticity, LF ceiling), plus `buildNetworkContext(routes)` (airport traffic and hub states) and `getLegAirportFeesMultiplier()`. The engine now calls these. Proof of no behavior change: all 222 store + 286 core tests pass, and the audit fare/plane sweep (13 values) is byte-identical before and after. **New `projectRouteEconomics()`** in `@acars/store` (`routeProjection.ts`): projects both directions with the engine's own functions and leg timing; returns per-leg and average LF, passengers, revenue/cost/profit per flight, flights/day, revenue and profit per day, market share and rival shares. Takes `networkRoutes` (the airline's routes plus the candidate) so congestion and hub demand match. `routeProjection.test.ts` checks the projection equals a real engine landing exactly (passengers, revenue, cost, profit) across 6 scenarios (two markets, fares ×1/×1.3/×5/×40, 3-aircraft route, A320neo long-haul). Two thin-market cases first differed (26 vs 33 pax) until hub state was included, which motivated `buildNetworkContext`. The S02 harness doesn't exist yet, so direct engine runs are the reference.

> Note for S24: `apps/web/.../routeEconomics.ts#estimateRouteEconomics` is a separate approximation (caller-supplied load factor) that can disagree with the engine; migrate its users to `projectRouteEconomics`.

- 2026-10-05 · fix · 3309eda · **Critical production bug found and fixed while building S23.2:** `getFuelPriceAtTick` cached every tick on a long forward jump, so the first lookup of a session (tick 0 → now) overflowed the Map's 2^24-entry limit once the clock passed ~16.8M ticks (about Sept 29). It threw `RangeError: Map maximum size exceeded` after ~18 s of blocking at every landing and on the Finance page. Long jumps now rebuild from the epoch-start price. Bit-identical prices (compared across epoch boundaries and backward jumps); regression test fails on the old code. **Should land on `main` independently of S23 (cherry-pick 3309eda).**
- 2026-10-05 · S23.2 · (this commit) · `RouteDecisionCard` at the top of the airport panel's Info tab whenever the player can open a route from a hub. Headline: projected **profit per day after lease** (green or red), then load factor, flights/day, rivals and market share, the recommended aircraft with its lease per day, a tier-range warning (demand halved beyond the tier limit) and an unprofitable warning. Recommendation (`utils/routeRecommendation.ts`): the cheapest lease among unlocked, in-range models that's profitable after lease, else the least-bad. Uses `projectRouteEconomics` with live rival offers, brand, tier limit, and the airline's routes plus the candidate (7/week, as `openRoute` stores it); recomputed once per game hour. Atlas facts collapsed into an "Airport details" `<details>`. en + es. Tests: recommendation picks a profitable tier-1 model, returns null out of range, picks the cheapest profitable lease; the card renders profit and aircraft or an out-of-range message. Screenshots taken in a **logged-in** e2e session (Play Free → create airline under the fake relay → `/airport/BCN`): MAD→BCN +$5,900/day, 88% LF, 6 flights/day, ATR 42-600.
- 2026-10-05 · S23.3 · (this commit) · `utils/launchRoute.ts`: pure `launchRoute(deps, plan)`. It opens the route (or reuses it), reuses an unassigned idle or still-delivering aircraft at the origin with enough range (otherwise leases `plan.model` at the origin), then assigns. Returns `complete | partial | failed`, with the completed steps, failed step, error, routeId and aircraftId. Each step checks the store first, so **calling it again resumes** (no second route, no second lease): this is the "finish setup" path. `hooks/useLaunchRoute.ts` wires the airline store (leasing = `purchaseAircraft(model, hub, …, "lease")`) and exposes `idle/running/done` state. A leased aircraft is delivered in 60 ticks (3 min) and then takes off on its own once assigned. 7 unit tests cover: happy path; reuse of route and idle aircraft; not reusing aircraft elsewhere, busy, or short-range; partial on lease failure then resume; partial on assignment failure then reuse of the leased aircraft; clean failure on openRoute; no-op when already flying.

## Follow-ups

- **Fuel first-lookup cost:** a cold `getFuelPriceAtTick` still takes ~6 s of CPU (epoch walk from genesis). Ship precomputed epoch checkpoints in `@acars/core` (deterministic, generated) or warm it in a worker. High priority: it freezes the tab on the first landing or Finance view of a session.
- **Logged-in layout bugs (pre-existing):** on desktop the airport panel's header slides under the context bar; on phones the "account not backed up" banner covers the top bar and panel header. Candidate for S22.
- **Relay stub gap:** a few real relay connections escape `context.routeWebSocket` during logged-in flows (seen in proxy logs), probably from a worker. Harmless in CI but not hermetic.
- **Logged-in e2e is possible:** Play Free → fill `#airline-name`/`#airline-icao` → "Launch Airline" works under the fake relay (set `timezoneId`/`geolocation` to pick the hub, raise the test timeout, and navigate client-side with `history.pushState` + `popstate`, since a reload re-reads state from the empty relay). S23.5 should turn this into a shared fixture.

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
