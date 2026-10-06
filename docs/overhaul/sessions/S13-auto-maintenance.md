# S13 — Auto-maintenance policy

> **Status:** ☑ merged
> **Next step:** — (merged in #176)
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
- [x] **S13.3** Fleet UI toggles + "next service" estimate + i18n. _Done when:_ screenshots.

## Details & guidance

- Schema + reducer + engine rule + tests (including catch-up replay over long absences).
- UI: fleet-wide default plus a per-aircraft override; show "next service in ~N days".

## Acceptance criteria

- [x] An aircraft with the policy on never grounds in a 90-day simulated absence; costs are charged identically on replay.

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
2026-10-06 · S13.3 · (this commit) · Fleet UI:

- **Fleet default.** `MaintenancePolicyControl` in the fleet header has an on/off switch, 'Service at' 30–70% condition and 'Only at a hub'.
- **Per aircraft.** `AircraftMaintenanceRow` on each card offers 'Fleet default (on/off)', 'On for this aircraft' or 'Off for this aircraft'. It also shows 'Next service in ~N days', or, with the policy off, 'Grounds in ~N days unless serviced'. The estimate comes from `nextService.ts` (route utilization, capped at block hours). When viewing another airline it shows the estimate only.
- **Core.** `CONDITION_WEAR_PER_FLIGHT_HOUR` moved to core and the engine uses it.
- **i18n and tests.** en and es strings under `fleet.autoMaintenance.*`; unit tests for the util and both components; e2e `maintenance-policy.spec.ts` turns the default on and checks the estimate. It passes locally, and I checked a screenshot.

## Follow-ups

- The visual catch-up projection (`reconcileFleetToTick`, `capLandingsForGrounding`) doesn't know about the policy. During a long catch-up the map may briefly show a policy-covered aircraft as parked until the tick loop reaches it. Money and state are unaffected.

## Handoff notes

- **Shipped.**
  - The `SET_MAINTENANCE_POLICY` action (fleet default plus per-aircraft override).
  - The engine rule at idle and turnaround end, at the manual price, only when affordable.
  - A fix for turnaround skipping grounding.
  - Fleet UI with a next-service estimate.
- **Gotchas.**
  - **Busy aircraft without a policy now really ground at 600 h.** Before this fix they never did. That's the intended rule, and it's why the auto policy matters.
  - commitlint rejects subjects that start upper-case (e.g. an action name).
