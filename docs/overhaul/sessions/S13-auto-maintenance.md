# S13 — Auto-maintenance policy

> **Status:** ☐ not started
> **Next step:** S13.1
> **Branch:** —
> **PR:** —
>
> **Track:** Economy · **Size:** M (3 steps) · **Depends on:** S03 · **Unblocks:** —
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Remove the manual maintenance chore while keeping its cost trade-off.

## Why (evidence)

- Groundings (condition < 0.2 or > 600 h) happen silently while players are away (audit §2.3).

## Read first

- `FlightEngine.ts` grounding logic
- `fleetSlice.performMaintenance`
- `packages/core/src/fleet.ts`

## In scope

- New action `SET_MAINTENANCE_POLICY` (per aircraft or fleet default: threshold %, "only at hub")
- Engine applies the policy deterministically at turnaround when conditions are met (ruleset-gated)
- Fleet UI toggle

## Out of scope

- Changing maintenance costs.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S13.1** `SET_MAINTENANCE_POLICY` action + reducer + tests. _Done when:_ tests green.
- [ ] **S13.2** Engine rule (ruleset-gated) + 90-day absence replay test. _Done when:_ no grounding with policy on.
- [ ] **S13.3** Fleet UI toggles + "next service" estimate + i18n. _Done when:_ screenshots.

## Details & guidance

- Schema + reducer + engine rule + tests (including catch-up replay over long absences).
- UI: fleet-wide default plus a per-aircraft override; show "next service in ~N days".

## Acceptance criteria

- [ ] An aircraft with the policy on never grounds in a 90-day simulated absence; costs are charged identically on replay.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
