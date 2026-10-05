# S33 — Deterministic world events

> **Status:** ☐ not started · **Track:** Loop · **Size:** L · **Depends on:** S03 (run after S32 or in a separate window — shared engine files) · **Unblocks:** S43 (event pins)
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- An event catalog (festival, sports final, strike, fuel spike, hub congestion) with modifiers in the ruleset.
- Tests: determinism, bounded effect sizes, no overlap explosions.

## Acceptance criteria

- [ ] The S02 harness shows bounded impact; the same events appear on all clients for the same tick.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
