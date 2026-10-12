# S71 — Passenger groups (three light types)

> **Status:** ◐ in progress
> **Next step:** S71.2 — engine: economy elasticity from the destination's mix
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** — (next)
>
> **Track:** People · **Size:** M (4 steps) · **Depends on:** D14 ✅ (2026-10-12: "three light types"), S63 · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §4 People

> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Not every passenger is the same: holiday-makers chase price, families visiting relatives are steadier, business travellers pay for the seat. Which of them fly a route depends on where it goes, and that changes how a fare change lands — a beach route punishes a fare rise, a business route forgives it. The player sees who flies, and hears them.

## Design

- **Three groups (core, pure):** leisure (price elasticity −1.6), visiting family (−1.0), business (−0.5).
- **Mix by destination** (its primary tag, the same one seasons use): beach and ski — 70 % leisure, 20 % family, 10 % business; business cities — 25 / 30 / 45; everywhere else — 45 / 40 / 15.
- **Economy cabin:** its price elasticity is the mix's weighted elasticity (general routes: −1.195, practically today's −1.2; beach −1.37; business cities −0.925). Business and first cabins are business travellers already (unchanged). One number per route, so the engine stays O(1) and nothing is simulated per passenger.
- **Where it applies:** the engine's landing economics (live and catch-up, ours and rivals'), and every projection that uses it (fare editor, what-if, route demand).
- **Visible:** "Who flies" on the route card and fare editor ("Mostly holiday-makers · price-sensitive"); landing voices speak as one of the groups, picked deterministically from the mix.

## Steps (checkpoints)

- [x] **S71.1** Core: `PassengerGroup`, `GROUP_ELASTICITY`, `groupMix(tag)`, `economyElasticity(mix)`, `dominantGroup`, `groupAt`; tests.
- [ ] **S71.2** Store/engine: economy elasticity from the destination's mix; projections follow; tests.
- [ ] **S71.3** Web: who flies (route card, fare editor), group voices; i18n; tests.
- [ ] **S71.4** e2e (desktop and phone), screenshots, PR.

## Progress log

2026-10-12 · brief · (this commit) · Written after the owner's D14 "three light types" and a read of the demand model: one economy elasticity constant feeds the engine (`computeFlightPassengers`), the fare editor and route demand.

2026-10-12 · S71.1 · (this commit) · **Groups, in core.** `groups.ts`: `PassengerGroup`, `GROUP_ELASTICITY` (−1.6 / −1.0 / −0.5), `groupMix` (by destination tag; unknown → general), `economyElasticity` (weighted, rounded to 3 decimals: general −1.195, beach/ski −1.37, business cities −0.925 — the brief first said 30/35/35 for business cities, which gives −1.005; changed to 25/30/45 so they forgive fare rises clearly), `dominantGroup`, `groupAt` (seeded pick for voices). 5 tests; core 454/454, 100 % functions.
