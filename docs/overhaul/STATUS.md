# ACARS Overhaul — Status & Resume Guide

> **Start here, every time.** This page tells any session (or person) how to pick the work up
> after any interruption, whether that's a few hours, a few weeks, or running out of credits
> mid-step.
> The plan itself lives in [`README.md`](README.md); each unit of work is a brief in
> [`sessions/`](sessions/).

## 1. Resume in 60 seconds

Paste this into a new session:

```text
Continue the ACARS overhaul. Read docs/overhaul/STATUS.md and follow its resume protocol.
Work one checkpoint step at a time: after each step, commit, push, and update the brief's
progress log in the same commit. Stop at a clean checkpoint if you run low on budget.
```

To target a specific session instead: `Execute session S23 from docs/overhaul (resume
protocol in docs/overhaul/STATUS.md).`

To see where things stand without an agent: `scripts/overhaul-status.sh` (or `--all`).

## 2. Resume protocol (agents follow this exactly)

1. **Find the work.**
   - Run `scripts/overhaul-status.sh`.
   - If a session is _in progress_, resume it. Otherwise take the first "Up next" session
     whose dependencies are merged and whose decisions (README §2) are made.
2. **Get the code.**
   - Fetch latest `main`.
   - If the brief lists a **Branch** that isn't merged, continue from it:
     `git fetch origin <branch>`, then merge it into your working branch (or check it out
     if your environment lets you use it directly).
   - If your environment assigns a different branch name, record the new name in the
     brief's **Branch** field in your first commit.
3. **Re-establish state.**
   - Read the brief's **Progress log**: the last line is where work stopped.
   - Compare it with `git log` on the branch. If commits exist past the last log line, the
     previous session was cut off after pushing: trust the code, then fix the log.
   - If the last line is `WIP`, finish exactly what it says remains.
   - Run `pnpm install && pnpm build && pnpm test` to confirm green before changing anything.
4. **Do one step.**
   - Implement the step named in **Next step**, staying inside the brief's scope.
5. **Checkpoint (one commit per step).**
   - Tests, lint and typecheck green.
   - In the same commit: tick the step's box, append a progress-log line, and advance
     **Next step**.
   - Commit message `<type>(<scope>): <lowercase summary> (Sxx.n)`, e.g.
     `test(web): add playwright smoke spec (S01.1)`. Commitlint (Conventional Commits)
     rejects a subject that starts with an uppercase token such as `S01.1`, so the step id
     goes at the end. Allowed types: feat, fix, test, docs, refactor, perf, build, ci,
     chore, style, revert.
   - Push immediately.
   - After the first step, open a **draft PR** and record it in the brief's **PR** field.
6. **Running low on budget mid-step?**
   - Stop adding scope.
   - If the work in progress is green, commit it as `chore(<scope>): wip <summary> (Sxx.n)` with a `WIP` log
     line saying exactly what's done and what remains. If it isn't green, stash the idea in
     that `WIP` line and revert to the last checkpoint.
   - Push. A pushed `WIP` line is all the next session needs.
7. **Finish the session** (all steps ticked):
   - Status `☑ ready for review`.
   - Fill in **Handoff notes**.
   - Mark the PR ready for review.
   - The owner merges and sets Status `☑ merged`; agents never merge.

Status values used in briefs: `☐ not started` · `◐ in progress` · `⏸ blocked: <reason>` ·
`☑ ready for review` · `☑ merged` · `⏭ skipped: <reason>`.

**Why this survives interruptions**:

- Work is never more than one step from a pushed checkpoint.
- Each step leaves `main`-mergeable green code, so even a half-finished session can be merged
  and its value banked.
- State lives in the briefs (committed with the code), not in anyone's memory or a chat log.

## 3. Recommended order

Ordered for a single owner with a limited budget: the highest impact per credit first. Every
row is useful on its own, so stopping after any row still leaves the game better.
Parallel-safe groups are in [`README.md` §4](README.md#4-waves-what-can-run-in-parallel).

| #   | Session | Priority | Steps | Why now                                                                                 |
| --- | ------- | -------- | ----- | --------------------------------------------------------------------------------------- |
| 1   | S01     | P0       | 5     | Safety net. Prevents another silent black-map release; gives every UI step screenshots. |
| 2   | S20     | P0       | 5     | The first impression: honest landing, one CTA, mobile overlap fix, link previews.       |
| 3   | S23     | P0       | 5     | First flight in ≤ 2 clicks; turns the airport panel into a decision card.               |
| 4   | S30     | P0       | 3     | Every check-in now tells a story. Cheap, standalone.                                    |
| 5   | S02     | P0       | 4     | Makes every economy change measurable. Needed before S14/S10.                           |
| 6   | S14     | P0       | 4     | Flights follow the route frequency (D8); fixes the 8–9× route-card error found by S02.  |
| 7   | S10     | P0       | 5     | Fixes "every route is the same" and the fare exploit: the core of "dull" (D1 decided).  |
| 8   | S21     | P1       | 4     | Two-field airline creation.                                                             |
| 9   | S22     | P1       | 3     | One name per screen; honest status bar.                                                 |
| 10  | S24     | P1       | 4     | Pricing shows profit; route-list i18n.                                                  |
| 11  | S31     | P1       | 4     | Always-visible next goal and tier progress.                                             |
| 12  | S40     | P1       | 4     | Real globe: the screenshot that sells the game.                                         |
| 13  | S41     | P1       | 3     | Profit-colored living routes.                                                           |
| 14  | S11     | P1       | 3     | Smooth oversupply; brand rewards good service.                                          |
| 15  | S12     | P1       | 4     | Lease-vs-buy choice, tier pacing, milestones.                                           |
| 16  | S04     | P1       | 4     | Start measuring before investing in growth.                                             |
| 17  | S25     | P2       | 4     | Assign planes from anywhere.                                                            |
| 18  | S13     | P2       | 3     | Auto-maintenance.                                                                       |
| 19  | S44     | P2       | 3     | Liveries front and center + poster.                                                     |
| 20  | S50     | P2       | 3     | Public airline pages with previews.                                                     |
| 21  | S42     | P2       | 3     | Aircraft family icons.                                                                  |
| 22  | S43     | P2       | 3     | Money and opportunity on the map.                                                       |
| 23  | S34     | P2       | 4     | Installable app + notifications (needs D3).                                             |
| 24  | S32     | P2       | 4     | Daily objectives (needs D6).                                                            |
| 25  | S54     | P0       | 4     | Owner: "ultra sluggish all the time". Stop the constant full-globe redraws.             |
| 26  | S33     | P2       | 3     | World events.                                                                           |
| 27  | S51     | P2       | 3     | Share loop.                                                                             |
| 28  | S26     | P3       | 4     | Guest sandbox.                                                                          |
| 29  | S45     | P3       | 4     | 3D globe-first prototype (decision D4).                                                 |
| 30  | S52     | P3       | 3     | Android release kit (needs D7).                                                         |
| 31  | S53     | P3       | 2     | Tycoon-mode design doc (needs D5).                                                      |

**Milestones to celebrate** (each is a coherent, shippable state):

- **M1 "First impression"**: S01, S20, S23, S30. A new player understands the game and flies
  within minutes.
- **M2 "Real decisions"**: S02, S03, S10. Routes and prices matter; the solved optimum is gone.
- **M3 "Feels like a game"**: S21, S22, S24, S31, S40, S41.
- **M4 "Depth & growth"**: everything else.

## 4. Decisions log

Update when the owner decides. Full context is in [`README.md` §2](README.md#2-decisions-the-owner-must-make).

| ID  | Decision                          | Status     | Date       | Outcome                                                                    |
| --- | --------------------------------- | ---------- | ---------- | -------------------------------------------------------------------------- |
| D1  | Flat ~87% LF intentional?         | ✅ decided | 2026-10-05 | No: make it a real market (S10: incumbents + fare cap, gentle Tier 1).     |
| D2  | Activation-tick rulesets          | ✅ decided | 2026-10-05 | No versioning: no real players yet, so rules change in place. S03 skipped. |
| D3  | Notification architecture         | ✅ decided | 2026-10-06 | Local first: system notifications from the app/PWA; Nostr DM bot later.    |
| D4  | Globe-first 3D shell go/no-go     | ⏳ open    |            |                                                                            |
| D5  | Fast Tycoon sandbox               | ⏳ open    |            |                                                                            |
| D6  | Reward validation model           | ✅ decided | 2026-10-07 | Replay-verified claims: rewards are pure functions of the action log.      |
| D7  | Store/domain/social account owner | ⏳ open    |            |                                                                            |
| D8  | Flights follow route frequency    | ✅ decided | 2026-10-05 | Yes: respect the weekly frequency (S14), capped by physics.                |

## 5. Budget notes

- A **step** is sized to fit comfortably in one agent sitting with room to test and push. If
  a step turns out bigger, split it in the brief (`Sxx.3a`, `Sxx.3b`) in the first checkpoint
  commit, then continue.
- Cheapest high-value steps when budget is tight: S01.1–S01.3, S20.1–S20.2, S30.1–S30.2,
  S23.1–S23.2. Each is valuable on its own.
- Re-run `scripts/overhaul-status.sh` at the start of every sitting. It costs nothing and
  prevents redoing work.
