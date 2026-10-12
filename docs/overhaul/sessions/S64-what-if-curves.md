# S64 — What-if curves for frequency and fares

> **Status:** ◐ in progress
> **Next step:** S64.2 — the chart in the frequency control and the fare editor
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #199 (with S61–S63) or the next one
>
> **Track:** Decisions · **Size:** M (3 steps) · **Depends on:** S58 · **Unblocks:** frequency-war stabilizers (the curve teaches the equilibrium) · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §6 Decisions, §7 game theory
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

A player choosing how often to fly or what to charge sees the whole curve, not one number: profit per day against weekly round trips (and against fares), with the sweet spot, where the route is now, the most the planes can fly, and the share of the city pair it buys. One tap moves the route to the sweet spot.

## Why

- Blueprint §6: decisions should show their consequences before they are made; §7: frequency competition is a prisoner's dilemma, and a curve that bends over (more flights, less profit each) teaches the equilibrium better than any text.
- Today the frequency control shows only "N legs a day" and the S58 "fly more"; the fare editor compares two points (saved and typed).

## Constraints

- Rule 3: a fixed number of O(1) projections (≤ 16 for frequency, 11 for fares) with the engine's own `projectRouteEconomics`; nothing per passenger.
- Re-project at most once per game hour (like the fare editor and S58); only when the chart is open.
- Money stays fixed-point in the engine; the curve converts to numbers for drawing only.

## Steps (checkpoints)

- [ ] **S64.1** Store: `frequencyCurve` and `fareCurve` (samples, best, current, max, share), `routeProjectionInputFor` (how a route flies today). _Done when:_ unit tests (sampling, best, monotonic load against fare, determinism).
- [ ] **S64.2** UI: `WhatIfCurve` (inline SVG, cockpit style: magenta profit line, dashed zero, green sweet spot, cyan "now", amber max) under a "What if?" toggle in the frequency control (tap a point to try it) and in the fare editor (tap to scale the typed fares). _Done when:_ component tests.
- [ ] **S64.3** e2e (desktop and phone) + 1440/390 screenshots; PR.

## Acceptance criteria

- [ ] A route with planes shows profit/day against frequency with the best point, now and max marked, and share at both.
- [ ] Tapping the curve sets the draft frequency (still needs Apply); the fare curve sets the typed fares.
- [ ] Fixed number of projections per game hour; clipped-control audit and full e2e green.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-12 · brief · (this commit) · Written after reading the S58 projection (`bestWeeklyFrequency`, operating-day cap) and the fare editor's saved-vs-typed outcome.

2026-10-12 · S64.1 · (this commit) · **The curves, in the store.** `frequencyCurve` samples 1 → the operating maximum (14 steps plus now and best) re-projecting the network at each frequency; `fareCurve` scales every fare together 60 % → 160 %; both return profit/day, load and share per point. `routeProjectionInputFor` turns a flying route into a projection input (the S58 suggestion now uses it). Store 282/282.
