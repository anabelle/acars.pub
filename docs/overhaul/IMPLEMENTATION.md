# How we build Blueprint v2 — safely and cheaply

> Companion to [`BLUEPRINT.md`](BLUEPRINT.md) (what) and [`STATUS.md`](STATUS.md) (where we are).
> This page is the _how_: order, guard rails, and how to spend as few tokens as possible.

## 1. Order of work

```
S58 utilization ──► S64 what-if curves
   │
S59 Cockpit + Ramp foundation ──► S60 plane panel + hangar ──► S61 delivery, logbook, spotter's book
                                │                           └─► S63 passengers visible
                                ├─► S62 instruments + Today story
                                └─► S65 ACARS feed
Wave B (S66–S74) only after its decision; Wave C (S75–S76) last.
```

- **S58 first**: it fixes a real economy bug and feeds the numbers every new screen shows (block hours, idle, day strips).
- **S59 before any screen**: it builds the shared pieces once (tokens, fonts, grain textures, signs, pictograms, avionics readouts, navigation-display layer). Every later session composes them instead of restyling, which is where most tokens are saved.
- After S60, S61/S62/S63/S65 touch different screens and can run in parallel worktrees.

## 2. Guard rails (safety)

1. **One step = one green commit**, pushed, with the brief's log updated (existing rule). A half-finished session is always mergeable.
2. **Wave A changes no rules of the game except S58.** No new Nostr event kinds, no reducer changes outside S58; new screens read existing state. Additive optional fields only (e.g. a plane's given name already exists as `aircraft.name`).
3. **Engine changes** (S58, Wave B): pure functions in `@acars/core` with unit tests, the same logic in slice and reducer, and a **catch-up equals live ticking** test. Measure economy effects with the S02 balance harness before and after.
4. **Screens are replaced one at a time**, never all at once. The old look stays on screens not yet migrated; S59 ships the tokens without changing layouts.
5. **Every UI step keeps three checks**:
   - the clipped-control audit (`docs/overhaul/media/s57/ux-audit.spec.ts.txt`, promoted to a permanent e2e in S59) on desktop 1440 and phone 390;
   - the S54 performance probes (the map must keep its clock and budgets);
   - screenshots of the changed screens only, attached to the brief.
6. **Accessibility**: 4.5:1 text contrast, 44 px targets, real buttons, reduced-motion respected (signs, queues, water salute).
7. **Determinism of visuals**: crowds, pictograms, voices and day strips are computed from aggregates and seeded by ids — never simulated passengers, never `Math.random()` at render.

## 3. Token budget (efficiency)

| Practice                                                                                                                                                                                        | Why it saves                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Briefs name exact files, functions and "done when" checks                                                                                                                                       | No exploratory reading; an implementer starts at step 1 |
| **Model split**: Opus writes the brief, reviews the diff and does the visual check; Sonnet implements one step from the brief; Haiku does Spanish strings, test scaffolding and screenshot runs | The expensive model only plans and verifies             |
| Shared UI kit from S59 (`shared/ui/cockpit`, `shared/ui/ramp`)                                                                                                                                  | Later sessions compose, they do not restyle             |
| Targeted tests while working (changed package, changed spec); full gate once per step; full e2e only before "ready" (CI runs it anyway)                                                         | Full suites are the biggest recurring cost              |
| Read files by range (`grep -n`, `sed -n a,bp`), never whole 1,500-line components                                                                                                               | Context stays small                                     |
| Never `biome check --write` on folders; format only touched files                                                                                                                               | Avoids huge unrelated diffs to review                   |
| Screenshots only of changed screens, at 1440 and 390                                                                                                                                            | Images are expensive context                            |
| Short PR bodies (see §4); details live in the brief                                                                                                                                             | Less text written, reviewed and merged                  |
| Parallel worktrees only for independent sessions (S61/S62/S63/S65)                                                                                                                              | Wall time drops without duplicate context               |

## 4. PR and merge hygiene

- **PR body ≤ 12 lines**: 2–4 summary bullets, a one-line test result, a link to the brief. No step-by-step narration (that's the brief's progress log).
- **Squash merge message**: GitHub's default squash message lists every commit in the PR. Because the session branch is reset with a `merge -s ours` after each merge, old already-merged commits stay on it and every squash message lists them all (141 commits by S58). Fix, either:
  - repository setting → _Pull Requests → Allow squash merging → Default commit message: **Pull request title and description**_ (recommended, combined with short PR bodies); or
  - after each merge, reset the session branch to `main` with a **force-with-lease** push (allowed only when the branch holds nothing but already-merged history), instead of `merge -s ours`.

## 5. Session checklist (copy into each brief)

- [ ] Read the brief and only the files it names.
- [ ] Implement the step; targeted tests green.
- [ ] Gate: `pnpm lint && pnpm typecheck && pnpm run typecheck:functions && pnpm --workspace-concurrency=1 -r test -- --run --coverage.enabled --coverage.thresholds.autoUpdate=false`; restore `geo.test.ts`, `season.test.ts`, `routeTree.gen.ts` afterwards.
- [ ] UI steps: audit e2e + screenshots of changed screens (1440, 390).
- [ ] Commit (`type(scope): lowercase summary (Sxx.n)`), push, update the brief's log in the same commit.
- [ ] Session done: short PR body, mark ready when CI is green.
