# S45 — Globe-first 3D shell prototype (deck.gl)

> **Status:** ☐ not started
> **Next step:** S45.1
> **Branch:** —
> **PR:** —
>
> **Track:** Graphics · **Size:** L (4 steps) · **Depends on:** S01 · **Unblocks:** Decision D4
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

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

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S45.1** Flagged `/play` route: deck.gl on globe with 3D arcs. _Done when:_ renders with real routes.
- [ ] **S45.2** Aircraft layer + synthetic load generator (1k/10k/50k). _Done when:_ fps recorded.
- [ ] **S45.3** Briefing drawer + contextual airport/route/plane cards. _Done when:_ screen recording.
- [ ] **S45.4** `docs/overhaul/prototype-report.md` with perf + parity checklist. _Done when:_ owner can decide D4.

## Details & guidance

- Perf report: 1k / 10k / 50k simulated aircraft on desktop and a mid-range Android (fps, memory, battery note).
- Interaction parity checklist vs the current shell (what's missing).
- A 60-second screen recording for the owner.

## Acceptance criteria

- [ ] The report and recording are in `docs/overhaul/prototype-report.md`; the owner records decision D4.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
