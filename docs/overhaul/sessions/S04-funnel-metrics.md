# S04 — Funnel metrics from Nostr events

> **Status:** ☑ merged
> **Next step:** — (merged in #174; S04.4 deferred)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #174
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
- [x] **S04.3** Report writer + first report in `docs/overhaul/metrics/` + usage docs. _Done when:_ report committed.
- [ ] **S04.4** (Optional) cookie-less page-view counter function. _Done when:_ counter increments in a local Pages dev run. **Deferred:** it needs a storage binding (KV, D1 or Analytics Engine), which is the owner's infrastructure choice.

## Details & guidance

- Funnel: `AIRLINE_CREATE` → first route open → first assignment → first landing (derived from assignment time + flight duration) → active on D1/D7/D30 (any signed action).
- Time-to-first-assignment distribution (median, p75).
- Weekly cohort table.
- README section on how to run it; add the first report.

## Acceptance criteria

- [x] The script runs against live relays and produces a report; the numbers are sanity-checked against the leaderboard's airline count. (Checked against every airline's saved state on the relays: 18 airlines all-time, 2 active in the window. See the S04.3 log line.)

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

2026-10-06 · S04.3 · (this commit) · First real report: `docs/overhaul/metrics/2026-10-06.md` (30 days, 8 of 9 relays read).

- **Result:** no airline created in the window; 2 airlines active (both on 2026-10-05, returning players from March). All-time, 18 airlines have a `v6-beta` saved state. That is the leaderboard's population, since the leaderboard is built from those saves.
- **Why the first live run read 0 events:** it scanned every kind-30078 event. Public relays carry that kind for many apps, the 40-page cap filled with their data, and they reject the `world` tag filter as unindexed. `scripts/funnel.ts` now reads with indexed filters only: `#d` for the fixed create/snapshot/checkpoint d-tags, then `authors` for those airlines' actions.
- **Saved state:** the client publishes `:snapshot`, never `:checkpoint`. `parseFunnelEvent` now reads both as saved state, so retention has a "last seen" again.
- **Expiration:** until 2026-09-10 every action, `AIRLINE_CREATE` included, expired after 14 days, so the March cohort's creates are gone. `ROUTE_OPEN` and `ROUTE_ASSIGN_AIRCRAFT` now persist too (`PERSISTENT_ACTION_TYPES` in `schema.ts`), so funnel stages stay measurable past 14 days.

## Follow-ups

- **`nostr.acars.pub` rejects most game saves.** `infra/relay/strfry.conf` sets `maxEventSize = 65536`, but current snapshots and `TICK_UPDATE`s are 110–137 KB. Since at least October none of them reach the game's own relay; they live only on public relays. Raise the limit (e.g. 262144) and redeploy, or shrink the payloads.
- `scripts/backfill-relay.ts` still uses world id `dev-v3` (the game is on `v6-beta`), so it backfills nothing current. Import `FUNNEL_WORLD_ID` or `WORLD_ID` instead.
- Funnel numbers start clean from 2026-10-06: creates persist since 2026-09-10, route opens and assignments from this PR on. Earlier cohorts can't be rebuilt from relays.

## Handoff notes

- **Shipped.** `pnpm funnel [--days n] [--report]`: funnel, time to first assignment, D1/D7/D30 retention and weekly cohorts from public relays, counts only. First report committed.
- **Not done.** S04.4 page-view counter (deferred, owner's storage choice).
- **Gotchas.**
  - Never scan kind 30078 unfiltered: public relays drown it in other apps' data. Use `#d` or `authors`.
  - Relays keep only the latest version of a replaceable event, and not always the same one, so daily "CHECKPOINT" counts are saves seen, not every save made.
  - Fix the relay's `maxEventSize` (Follow-ups) before relying on `nostr.acars.pub` alone.
