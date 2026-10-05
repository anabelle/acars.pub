# S33 — Deterministic world events

> **Status:** ☐ not started
> **Next step:** S33.1
> **Branch:** —
> **PR:** —
>
> **Track:** Loop · **Size:** L (3 steps) · **Depends on:** S03 (run after S32 or in a separate window — shared engine files) · **Unblocks:** S43 (event pins)
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

The world does things: demand surges, fuel shocks and congestion days that create "act now" opportunities.

## Why (evidence)

- Audit §2.3: nothing happens beyond fuel drift and seasons.

## Read first

- `packages/core/src/fuel.ts`, `demand.ts`, `prng.ts`
- `FlightEngine.ts` demand path

## In scope

- `getActiveEvents(tick, ruleset)`: seeded schedule of events with region/airport scope, duration and modifiers
- Engine applies modifiers in O(active events per route endpoint)
- Ticker + map pin data + a cockpit card

## Out of scope

- Weather API integration (non-deterministic; excluded).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S33.1** Event catalog + `getActiveEvents(tick)` + tests. _Done when:_ deterministic schedule.
- [ ] **S33.2** Engine modifiers (ruleset-gated) + S02 impact report. _Done when:_ bounded impact.
- [ ] **S33.3** Ticker/cockpit card + map pin data. _Done when:_ screenshots.

## Details & guidance

- An event catalog (festival, sports final, strike, fuel spike, hub congestion) with modifiers in the ruleset.
- Tests: determinism, bounded effect sizes, no overlap explosions.

## Acceptance criteria

- [ ] The S02 harness shows bounded impact; the same events appear on all clients for the same tick.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
