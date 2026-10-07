# S32 — Deterministic daily objectives

> **Status:** ◐ in progress
> **Next step:** S32.3
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #182
>
> **Track:** Loop · **Size:** L (4 steps) · **Depends on:** decision D6 (S12 recommended) · **Unblocks:** S51 (rewards) · **Gated by D6**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Give every check-in a short-horizon goal that's the same for all players and verifiable by any client.

## Why (evidence)

- Audit §2.2/§2.3: no short-horizon goals; design bible engagement loops.

## Read first

- `packages/core/src/prng.ts`, `season.ts`
- `actionReducer.ts`

## In scope

- `getDailyObjectives(utcDate, ruleset)`: pure, seeded by date; 3 objectives/day from a template table (carry N pax to a tag, open a route > X km, hit LF band on a route, …)
- Progress evaluator: pure function of the action log + engine results in the window
- `CLAIM_OBJECTIVE` action: the reducer re-verifies and applies a fixed-point reward from the ruleset
- Cockpit widget

## Out of scope

- Weekly or seasonal objectives (follow-up).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S32.1** Objective templates + `getDailyObjectives(date)` + determinism tests. _Done when:_ same objectives across clients.
- [x] **S32.2** Progress evaluator over action log + engine results. _Done when:_ tests green.
- [ ] **S32.3** `CLAIM_OBJECTIVE` action + reducer verification + replay tests. _Done when:_ invalid claims rejected on replay.
- [ ] **S32.4** Cockpit objectives widget (en + es). _Done when:_ screenshots.

## Details & guidance

- Anti-abuse: claims are idempotent per (pubkey, date, objective) and invalid claims are rejected on replay.
- Tests: identical objectives across clients for the same date; claim verification; replay.

## Acceptance criteria

- [ ] Two independent replays agree on balances after claims; the widget shows progress live.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · S32.1 · (this commit) · **Objectives for the day.** D6 decided: replay-verified claims. New `packages/core/src/objectives.ts`:

- **Action-based on purpose.** Landings and passengers reach a replay only through replaceable `TICK_UPDATE` payloads (relays keep the latest), so a claim on them could verify on one client and fail on another. Objectives are about durable player actions instead: open a route (any / ≥1,000 km / ≥3,000 km), open a route to a beach, ski or business airport, acquire an aircraft, assign aircraft (1 or 2), tune fares, adjust a schedule, service aircraft (1 or 2). Engine-result objectives are a follow-up.
- **`getDailyObjectives(date)`.** Seeds mulberry32 with the UTC day number (salted), Fisher–Yates over the 7 templates, takes 3 distinct kinds and one variant each. IDs are `${date}:${kind}`. Invalid or impossible dates throw.
- **Window.** `objectiveDayWindow(date)` gives the day's exact `[startTick, endTick)` (1 day = 28,800 ticks); `utcDateForTick(tick)` maps back.
- **Rewards.** Fixed-point, $25k to $200k: a nudge, not income; actions that cost money pay more.
- **Tests.** Same output for the same date, pinned for 2026-10-07 (catches a generator change that would desync clients); 400 days of distinct kinds with valid variants; variety over 120 days uses every kind; window covers exactly one UTC day and days chain.

2026-10-07 · S32.2 · (this commit) · **Progress.**

- **Core evaluator.** `evaluateObjective` / `evaluateDailyObjectives(date, activities, lookup)` count the activities inside the objective's UTC day. Counting is by distinct route or aircraft, so repeating an action on the same aircraft doesn't fill a "2 aircraft" objective. Route distance and destination tags come from the airport catalog (a lookup the caller passes, so core stays catalog-free), never from the event's declared `distanceKm`. Unknown airports never qualify.
- **Ledger in the replay.** `replayActionLog` records an `ObjectiveActivity` only for accepted, state-changing actions:
  - a route that really opened (not an aliased retry)
  - a new or used aircraft acquired
  - an aircraft moved to a different route
  - fares or frequency that actually changed
  - maintenance performed
- **Pruning and checkpoints.** The ledger (`activity` + `claimed`) is pruned to the newest activity's day and the day before. The cutoff is the ledger's own newest tick, not the clock, so pruning stays a pure function of the log. The ledger rides on `Checkpoint.objectives` (optional, so older checkpoints still load). A replay resumed from a checkpoint matches a full replay (test). It resets on airline create and dissolve.
- **Not yet wired.** The store state and snapshots don't carry the ledger yet; S32.3 adds that with claims.

## Follow-ups

- Engine-result objectives (carry N pax, hit a load-factor band) need durable daily summaries in the replay first.

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
