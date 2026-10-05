# S04 — Funnel metrics from Nostr events

> **Status:** ☐ not started · **Track:** Foundations · **Size:** M · **Depends on:** — · **Unblocks:** S53, success metrics in README §6
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Funnel: `AIRLINE_CREATE` → first route open → first assignment → first landing (derived from assignment time + flight duration) → active on D1/D7/D30 (any signed action).
- Time-to-first-assignment distribution (median, p75).
- Weekly cohort table.
- README section on how to run it; add the first report.

## Acceptance criteria

- [ ] The script runs against live relays and produces a report; the numbers are sanity-checked against the leaderboard's airline count.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
