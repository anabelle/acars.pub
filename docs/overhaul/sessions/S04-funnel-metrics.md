# S04 — Funnel metrics from Nostr events

> **Status:** ◐ in progress
> **Next step:** S04.3
> **Branch:** `claude/zen-darwin-3op878`
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

- [x] **S04.1** Relay reader: fetch action events by date range, count by type/day. _Done when:_ counts print for the last 7 days.
- [x] **S04.2** Funnel, time-to-first-assignment, D1/D7/D30 cohorts. _Done when:_ numbers sanity-checked vs leaderboard.
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

2026-10-06 · S04.1 · (this commit) · Relay reader. `packages/nostr/src/funnel.ts` is pure and dependency-free:

- `parseFunnelEvent` reads world actions plus airline checkpoints.
- `collectFunnelEvents` de-duplicates across relays.
- `countByDayAndType` lists every UTC day, with per-type counts and active airlines.
- `formatDailyCounts` prints the table.
- `FUNNEL_WORLD_ID` is tested to equal `WORLD_ID`.

`scripts/funnel.ts` (`pnpm funnel --days 7 [--relay url]`) pages kind-30078 events by `until` from each relay and prints counts only. **Live run blocked in the agent container:** the environment's network policy answers 403 to every relay host (`nostr.acars.pub`, `relay.damus.io`, `nos.lol`, …). The CLI runs and prints the empty 7-day table, and the counting logic is covered by fixture tests. Sanity-checking against real data needs the relay hosts allowed, or a run from a machine with relay access.
2026-10-06 · S04.2 · (this commit) · Funnel maths in `funnel.ts`:

- `buildJourneys` builds one journey per airline whose `AIRLINE_CREATE` is in range, with created, first route, first assignment, first landing and last seen. First landing is estimated as assignment time plus the route distance ÷ 500 km/h, with a 2 h fallback. Last seen is the latest action or checkpoint.
- `summarizeFunnel` gives the funnel and D1/D7/D30 retention. Retention means seen on or after day N, counted only once a cohort is old enough to measure.
- `timeToFirstAssignment` gives nearest-rank median and p75.
- `weeklyCohorts` groups by UTC-Monday week.

`pnpm funnel` prints all of it. **Sanity check against the leaderboard is pending:** relay hosts are blocked from this container (see S04.1). The step's code is done and fixture-tested.
2026-10-06 · S04.3 WIP · (this commit) · Done:

- `formatFunnelReport` (pure, tested; never prints pubkeys).
- `pnpm funnel --report` writes `docs/overhaul/metrics/<day>.md`.
- Usage docs and metric definitions in `docs/overhaul/metrics/README.md`.

**Remaining: the first real report.** Relays are unreachable from the agent container (403), so I didn't commit an empty report. Next: run `pnpm funnel --days 30 --report` with relay access, sanity-check the created count against the leaderboard's airline count, commit the report, and tick S04.3.

## Follow-ups

- `scripts/backfill-relay.ts` still uses world id `dev-v3` (the game is on `v6-beta`), so it backfills nothing current. Import `FUNNEL_WORLD_ID` or `WORLD_ID` instead.
- Regular action events expire from relays after 14 days (only `AIRLINE_CREATE` and `AIRLINE_DISSOLVE` persist). D30 retention must therefore lean on each airline's latest checkpoint (`created_at`) as 'last seen' (S04.2).

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
