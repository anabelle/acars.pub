# S13 — Auto-maintenance policy

> **Status:** ☐ not started · **Track:** Economy · **Size:** M · **Depends on:** S03 · **Unblocks:** —
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Schema + reducer + engine rule + tests (including catch-up replay over long absences).
- UI: fleet-wide default plus a per-aircraft override; show "next service in ~N days".

## Acceptance criteria

- [ ] An aircraft with the policy on never grounds in a 90-day simulated absence; costs are charged identically on replay.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
