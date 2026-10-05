# S45 — Globe-first 3D shell prototype (deck.gl)

> **Status:** ☐ not started · **Track:** Graphics · **Size:** L · **Depends on:** S01 · **Unblocks:** Decision D4
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

## Goal

Prove or disprove the globe-first 3D interface: the world is the whole UI, with a briefing drawer and contextual cards.

## Why (evidence)

- Owner's request to rethink the UI from first principles; audit discussion of 3D options.

## Read first

- `docs/DESIGN_PRINCIPLES.md` (Mini Metro / Factorio targets)
- `packages/store` public hooks
- deck.gl + MapLibre globe interleaving docs

## In scope

- A new route `/play` behind a feature flag, built from **new files only**: deck.gl `ArcLayer` (3D great-circle arcs), `ScenegraphLayer` or `IconLayer` for aircraft, briefing drawer, contextual card on click
- Reuse store hooks and S23's projection if merged

## Out of scope

- Replacing the existing shell. This is a prototype.

## Tasks

- Perf report: 1k / 10k / 50k simulated aircraft on desktop and a mid-range Android (fps, memory, battery note).
- Interaction parity checklist vs the current shell (what's missing).
- A 60-second screen recording for the owner.

## Acceptance criteria

- [ ] The report and recording are in `docs/overhaul/prototype-report.md`; the owner records decision D4.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
