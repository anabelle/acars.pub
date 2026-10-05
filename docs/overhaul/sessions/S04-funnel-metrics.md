# S04 — Funnel metrics from Nostr events

> **Status:** ☐ not started
> **Next step:** S04.1
> **Branch:** —
> **PR:** —
>
> **Track:** Foundations · **Size:** M (4 steps) · **Depends on:** — · **Unblocks:** S53, success metrics in README §6
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Measure the funnel without tracking users: derive activation and retention from public game events, plus a cookie-less page-view count.

## Why (evidence)

- There's no analytics (ledger A18) and "zero traction" is unmeasured (A24).

## Read first

- `packages/nostr/src` (event kinds, action schema)
- `apps/web/src/workers/auditor.ts` (existing relay-reading worker)
- `functions/` (Cloudflare Pages Functions)

## In scope

- New `scripts/funnel.ts`: reads action events from the configured relays over a date range
- Output `docs/overhaul/metrics/YYYY-MM-DD.md` (counts only, no pubkeys)
- Optional page-view counter in a Pages Function: count only, no cookies, no IP storage

## Out of scope

- Any per-user tracking or third-party analytics script.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S04.1** Relay reader: fetch action events by date range, count by type/day. _Done when:_ counts print for the last 7 days.
- [ ] **S04.2** Funnel, time-to-first-assignment, D1/D7/D30 cohorts. _Done when:_ numbers sanity-checked vs leaderboard.
- [ ] **S04.3** Report writer + first report in `docs/overhaul/metrics/` + usage docs. _Done when:_ report committed.
- [ ] **S04.4** (Optional) cookie-less page-view counter function. _Done when:_ counter increments in a local Pages dev run.

## Details & guidance

- Funnel: `AIRLINE_CREATE` → first route open → first assignment → first landing (derived from assignment time + flight duration) → active on D1/D7/D30 (any signed action).
- Time-to-first-assignment distribution (median, p75).
- Weekly cohort table.
- README section on how to run it; add the first report.

## Acceptance criteria

- [ ] The script runs against live relays and produces a report; the numbers are sanity-checked against the leaderboard's airline count.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
