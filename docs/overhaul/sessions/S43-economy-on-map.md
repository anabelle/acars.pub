# S43 — Economy on the map

> **Status:** ☐ not started
> **Next step:** S43.1
> **Branch:** —
> **PR:** —
>
> **Track:** Graphics · **Size:** M (3 steps) · **Depends on:** S42, S23 (S33 for event pins) · **Unblocks:** —
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Money and opportunity are visible on the world itself.

## Why (evidence)

- Audit §2.8 and U11 (no juice).

## Read first

- S23 `projectRouteEconomics`
- landing events in the store/timeline

## In scope

- Floating `+$` labels on landings (pooled, capped count)
- Opportunity heatmap from the selected hub (projected profit/day per destination, computed in a worker, cached per hub + tick bucket)
- Event pins from S33 if merged

## Out of scope

- Sound (follow-up).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S43.1** Pooled floating `+$` landing labels (reduced-motion aware). _Done when:_ screen recording.
- [ ] **S43.2** Worker-based opportunity computation + cache per hub/tick bucket. _Done when:_ no main-thread task > 50 ms.
- [ ] **S43.3** Heatmap layer + event pins (if S33 merged). _Done when:_ screenshots.

## Details & guidance

- Respect `prefers-reduced-motion`.
- Heatmap computation must stay off the main thread.

## Acceptance criteria

- [ ] Screenshots/video; no main-thread long tasks > 50 ms from the heatmap.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
