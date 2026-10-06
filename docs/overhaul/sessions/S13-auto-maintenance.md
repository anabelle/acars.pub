# S13 — Auto-maintenance policy

> **Status:** ◐ in progress
> **Next step:** S13.3
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #176
>
> **Track:** Economy · **Size:** M (3 steps) · **Depends on:** — · **Unblocks:** —
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
- Engine applies the policy deterministically at turnaround when conditions are met (constant in core)
- Fleet UI toggle

## Out of scope

- Changing maintenance costs.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S13.1** `SET_MAINTENANCE_POLICY` action + reducer + tests. _Done when:_ tests green.
- [x] **S13.2** Engine rule (constant in core) + 90-day absence replay test. _Done when:_ no grounding with policy on.
- [ ] **S13.3** Fleet UI toggles + "next service" estimate + i18n. _Done when:_ screenshots.

## Details & guidance

- Schema + reducer + engine rule + tests (including catch-up replay over long absences).
- UI: fleet-wide default plus a per-aircraft override; show "next service in ~N days".

## Acceptance criteria

- [ ] An aircraft with the policy on never grounds in a 90-day simulated absence; costs are charged identically on replay.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S13.1 · (this commit) · Policy plumbing:

- **Core.** `MaintenancePolicy {enabled, minCondition, hubOnly}`. It lives on `AirlineEntity.maintenancePolicy` (fleet default) and `AircraftInstance.maintenancePolicy` (override; null means inherit). New `fleet.ts` exports:
  - `GROUNDED_MIN_CONDITION` 0.2 and `GROUNDED_MAX_HOURS_SINCE_CHECK` 600, now shared rather than magic numbers;
  - `AUTO_MAINTENANCE_HOURS_SHARE` 0.9 (service at 540 h) and the threshold clamp of 0.25–0.95;
  - `DEFAULT_MAINTENANCE_POLICY` (off, 0.40);
  - `maintenanceCost` (same formula as the manual action), `isGrounded`, `sanitizeMaintenancePolicy`, `effectiveMaintenancePolicy`, `needsAutoMaintenance`.
- **Action.** New `SET_MAINTENANCE_POLICY` with payload `{instanceId?, policy | null}`. The reducer sets the fleet default, or sets or clears an aircraft override, and ignores malformed payloads. Every later airline update spreads the airline, so the policy survives replay.
- **Store.** `setMaintenancePolicy(policy, aircraftId?)` updates optimistically, publishes, and rolls back if the publish fails.
- **Tests.** Core, reducer replay and slice.
  2026-10-06 · S13.2 · (this commit) · Engine rule:
- **New argument.** `processFlightEngine` takes a `maintenance` argument (`{fleetPolicy, hubs}`, passed by the engine slice).
- **Idle aircraft.** When the effective policy (the aircraft's own, else the fleet default) says it's due, the aircraft is serviced at `maintenanceCost` (the manual price), if the airline can pay. It gets the same downtime and an `evt-automaint-*` timeline event.
- **Pre-existing bug fixed.** Turnaround chained straight into the next departure, so busy aircraft never went idle and the 600 h / 20% grounding was never enforced. A 90-day ATR run reached 1,362 h. Turnaround end now drops a grounded or due aircraft to idle, where the rule above services or grounds it.
- **Constants.** Grounding constants now come from core; the visual catch-up keeps its own landing cap and doesn't apply the policy.
- **Tests.** `autoMaintenance.test.ts` runs a 90-day absence (MAD–BCN, 70 round trips a week):
  - policy off: grounds;
  - policy on: never grounds, and is serviced on time;
  - charges identically on replay;
  - hub-only services only at MAD;
  - no service when the airline can't pay;
  - an aircraft override beats the fleet default.

The balance report is unchanged.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
