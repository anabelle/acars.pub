# S32 — Deterministic daily objectives

> **Status:** ☑ ready for review
> **Next step:** — (awaiting merge of #182)
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
- [x] **S32.3** `CLAIM_OBJECTIVE` action + reducer verification + replay tests. _Done when:_ invalid claims rejected on replay.
- [x] **S32.4** Cockpit objectives widget (en + es). _Done when:_ screenshots.

## Details & guidance

- Anti-abuse: claims are idempotent per (pubkey, date, objective) and invalid claims are rejected on replay.
- Tests: identical objectives across clients for the same date; claim verification; replay.

## Acceptance criteria

- [x] Two independent replays agree on balances after claims; the widget shows progress live.

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

2026-10-07 · S32.3 · (this commit) · **Claims.**

- **`CLAIM_OBJECTIVE` `{ objectiveId }`.** The replay runs `verifyObjectiveClaim` (core) on every client. A claim pays only if all of these hold:
  - the id is one of that day's objectives;
  - it's made that UTC day or the next (a late check-in still pays), never before;
  - it hasn't been claimed already;
  - the ledger shows the objective complete at that point in the log.
- **Rejected claims.** A claim that fails is ignored, like any other invalid action. A successful one credits the fixed-point reward and adds an `objective_reward` timeline entry ("Daily objective complete", en/es toast).
- **Catalog.** The replay awaits the airport catalog only when the log contains a claim, so every verifier checks routes against the same data.
- **Ledger placement.** The ledger moved onto `AirlineEntity.objectives` instead of a `Checkpoint` field, so local storage (Dexie), snapshots and the state hash carry it with no extra plumbing.
- **Optimistic store.** The store applies actions before publishing, so the local replay of a new action sees its own optimistic copy. The rules that keep the local ledger the same as everyone else's:
  - A route open or purchase re-applied at the same tick as its copy still counts (new `Route.openedAtTick`; the aircraft's `purchasedAtTick`). A later re-send of an old id doesn't.
  - An assignment counts when it moves the aircraft or matches its `routeAssignedAtTick`.
  - Fare and frequency updates count whenever accepted, even when nothing changed (the local replay can't tell). That is why those two pay the least ($25k).
- **Store.** `claimObjective(id)` publishes without an optimistic update: the replay verifies and credits it.
- **Tests.** Core verdicts: valid, next day, too early, too late, unknown id, duplicate, incomplete, order in the log. Store replays:
  - credited once, with its timeline entry;
  - a padded `distanceKm` doesn't pass;
  - claiming before the work doesn't pay;
  - another author's claim is ignored;
  - optimistic re-application counts;
  - a full replay and a checkpoint-resumed replay agree on balance and ledger after three claims and a duplicate across the boundary.

2026-10-07 · S32.4 · (this commit) · **Cockpit widget.**

- **`DailyObjectivesCard`.** Shown under the first-hour checklist, own airline only. It lists:
  - today's three objectives in plain sentences ("Open a route of at least 3,000 km", "Open a route to a ski destination");
  - progress (n/target) and the reward;
  - a Claim button only when the claim will pay (it runs the same evaluator as the replay), then a "Claimed" badge;
  - the time until UTC midnight;
  - "Still claimable from yesterday" for completed, unclaimed objectives from the day before.
- **Claiming.** Goes through `claimObjective`, with a success or error toast. en/es strings.
- **Helper.** `deriveObjectiveBoard` (pure) builds the board from the engine tick and the airline's ledger.
- **Tests.**
  - Unit: board, carryover, no ledger. Component: rows, progress, claim / claimed states, reset time, claim success and failure, Spanish.
  - e2e `daily-objectives.spec.ts`, clock pinned to 2026-10-09: launch MAD → BCN (which also completes "buy or lease an aircraft", proving the optimistic re-application path live), add a weekly round trip, claim "change a route's weekly frequency", reload in Spanish and it's still claimed.
  - Screenshots (en start / claimable / claimed, es claimed) were shared in the session (run with `S32_SCREENSHOT=<dir>` to regenerate).

## Follow-ups

- Engine-result objectives (carry N pax, hit a load-factor band) need durable daily summaries in the replay first.
- Snapshot trust: a forged snapshot could carry a forged ledger, the same exposure as its forged balance today; the S12 verifier work covers both.

## Handoff notes

- **Shipped.** Deterministic daily objectives (core), a two-day objective ledger built by the action replay and stored on the airline, replay-verified `CLAIM_OBJECTIVE` with fixed-point rewards, and the cockpit card (en/es).
- **Not shipped.** Engine-result objectives (passengers, load factor) and weekly or seasonal objectives; see Follow-ups.
- **Gotchas.**
  - The store applies actions optimistically before publishing, so the local replay of a new action runs on top of its own copy. Activity recording therefore recognises "the same event re-applied" by tick (`Route.openedAtTick`, `purchasedAtTick`, `routeAssignedAtTick`). Keep that in mind before adding a new objective kind.
  - Changing `OBJECTIVE_TEMPLATES` or the generator changes the objectives (and invalidates claims) for every day; the pinned inline snapshot in `objectives.test.ts` will flag it. With D2 (no versioning) that's allowed, but do it knowingly.
  - The replay awaits the airport catalog only when the log contains a claim.
