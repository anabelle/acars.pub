# S26 — Guest sandbox airline

> **Status:** ☑ ready for review
> **Next step:** —
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #186
>
> **Track:** UX · **Size:** L (4 steps) · **Depends on:** S21, S23 · **Unblocks:** —
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Guests play immediately on a local-only airline; "Save your airline" creates the identity and publishes their actions.

## Why (evidence)

- Audit U4: everything is locked behind identity creation.

## Read first

- `identitySlice.ts` (ephemeral keys, `createAirline`)
- `actionReducer.ts`, `actionChain.ts`, `outbox.ts`
- `IdentityGate.tsx`

## In scope

- A sandbox mode in the store: actions go to a local log reduced by the same `actionReducer`, never published
- Save flow: create the key, publish `AIRLINE_CREATE` + the sandbox actions in order, re-anchored to the current tick (document the rules)

## Out of scope

- Ranked play from the sandbox. Sandbox airlines aren't on the leaderboard until saved.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S26.1** Write the sandbox time-mapping design in this brief (Follow-ups → Decisions). _Done when:_ owner can review.
- [x] **S26.2** _(option B)_ Hide abandoned airlines from the world, rival lists and leaderboard. _Done when:_ unit + world-sync tests.
- [x] **S26.3** _(option B)_ Backup prompt at the right moments (after the first landing, on the first return visit), en/es. _Done when:_ component tests + e2e.

_The original S26.2–S26.4 (full sandbox) were replaced by the owner's choice of option B on 2026-10-07; option A stays documented under Decisions._

## Details & guidance

- Decide and document how sandbox time maps on save (recommended: actions are replayed at save time; sandbox earnings aren't carried over, only the network setup).
- Tests for save replay and failure recovery.

## Acceptance criteria

- [x] _(option B)_ Guests keep instant play; abandoned airlines no longer clutter the world; guests are prompted to keep their key when it matters.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · S26.1 · (this commit) · **Design written for review** (see Decisions below). Recommends option B (the lighter path) because S20/S21 already removed most of the friction this session was written for; option A, the full sandbox, is designed in detail in case the owner prefers it. Waiting on the owner's choice before S26.2.

2026-10-07 · decision · — · **Owner chose option B** (lighter path). Steps rewritten accordingly.

2026-10-07 · S26.2 · (this commit) · **Abandoned airlines leave the world.**

- **Helper.** `packages/store/src/abandonedAirlines.ts`: `isAbandonedAirline(routes, lastActiveTick, currentTick)` is true for an airline with no active route and no activity for more than 7 days. Unknown activity never counts as abandoned.
- **World sync.** It checks each verified snapshot, with last activity = max(the airline's `lastTick`, the snapshot's tick). Abandoned airlines are removed from `competitors`, `fleetByOwner` and `routesByOwner`, so the map, rival lists and leaderboard (all fed by those) skip them.
- **No market effect.** They have no routes, so they were never in the market.
- **They come back.** They stay on relays, and the next sync after they act brings them back. Opening their public page by URL still works (a separate per-airline sync).
- **Tests:** the helper's edges; world sync drops a routeless airline idle 8 days (even one already listed) and keeps a rival flying a route.

2026-10-07 · S26.3 · (this commit) · **Backup prompt at the moments that matter.**

- **When.** `features/identity/lib/backupPrompt.ts` decides: the first time the airline has flown ("landing"), then once on the next visit, meaning a new browser session ("return"). Each is shown once per account. A first landing that happened while the player was away gets the landing prompt on that visit and the return prompt on the next. A backed-up key (copy or download) ends both. Blocked storage never throws.
- **What.** `KeyBackupPrompt` is a floating card, not a modal, so it never stacks on the "while you were away" report. It reuses `EphemeralKeyBackupActions`, so one tap copies or downloads the key, without the wallet-upgrade button. It offers "Not now" and a close button. It is mounted next to the banner for ephemeral players only. The banner stays as the standing reminder.
- **Strings:** en + es (`identity:backupPrompt.*`).
- **Tests.**
  - Unit: the decision across visits, accounts, a secured key and blocked storage.
  - Component: waits for the landing, shows once per visit, welcomes the player back once, closes for good on copy, and never shows for a secured account.
  - e2e (`key-backup-prompt.spec.ts`): a guest launches MAD → BCN, game time runs until the first landing, and the prompt appears. In English, downloading the key file dismisses it; in Spanish, "Ahora no" does.
- **Not covered by e2e:** the return-visit prompt. The fake relay stores nothing, so a reload loses the airline; component tests cover it instead.
- **Gotcha:** an e2e test that launches a route must wait for the "is live" toast before navigating away. The route list shows up as soon as the route opens, before the lease and assignment finish, and leaving early left the aircraft unassigned.
- **Checks:** gate green, full e2e 68 passed.

## Follow-ups

- `?demo` read-only tour (option B, item 3): only if the S04 funnel shows guests bouncing before "Play for free".
- Return-visit prompt in e2e, once the fake relay can persist events across a reload.

## Decisions (S26.1 design, for the owner)

### Where things stand (2026-10-07)

The audit (U4) said everything was locked behind identity creation. Since then S20 and S21 changed the front door: **"Play for free" makes a throwaway Nostr key in the browser in one click**, the creator asks only for a name (code, callsign and colours are suggested) and the player is flying within a minute. The key is stored on the device, `SecurityUpgradeBanner` and `EphemeralKeyBackupActions` nudge the player to back it up, and everything is published like any other airline.

So the friction U4 measured is gone. What remains are two smaller problems:

1. **World clutter.** Guests who leave after a minute still publish an `AIRLINE_CREATE` (and maybe a route). Those airlines stay in the shared world and on the leaderboard; nothing filters abandoned airlines.
2. **Lost airlines.** A guest who never backs up the key loses the airline when browser storage is cleared.

### Option A: the full sandbox (as this brief describes)

Guests play on a local-only airline; "Save your airline" creates the key and publishes.

- **Store mode.** `sandbox: true` in the identity slice. Actions go through the same `replayActionLog` from the same baseline as published ones (so the reducer stays the single source of truth), but into a local log (Dexie table `sandboxActions`) instead of the outbox. No relay traffic, no TICK_UPDATE publishing, no snapshots.
- **IDs.** Route and aircraft ids are already deterministic from `actionSeq`; the sandbox keeps its own sequence, so saved ids stay stable.
- **Time on save (recommended rule):** the sandbox's network _setup_ carries over, its _history_ doesn't.
  - Publish `AIRLINE_CREATE` at the save tick with the normal starting balance.
  - Then publish the sandbox's setup actions in their original order, each re-stamped with the save tick (hub changes, route opens, purchases and leases, assignments, fares, frequencies, policies). Costs are charged again at today's prices, exactly as the reducer would for a new airline.
  - Sandbox earnings, flights, maintenance history, timeline and objective progress are **not** carried over. They happened in a world nobody else saw, and replaying them would let a guest mint money offline.
  - Aircraft bought in the sandbox are re-delivered from the save tick (the normal 3-minute delivery), so the first flights start after saving.
- **Failure recovery.** Each re-stamped action goes through the existing outbox with its deterministic ids, so a crash mid-save resumes from the last acknowledged event, and the reducer's duplicate-id handling (route aliasing, `fleetById.has`) makes retries idempotent. The sandbox log is deleted only after the last action is acknowledged.
- **Tests (S26.4):** saving a sandbox with N routes and M aircraft and then replaying the relay log yields the same routes, fleet and assignments as the sandbox; an interrupted save, retried, yields the same result with no duplicates.
- **Cost:** large. It touches the identity slice, the action chain, the outbox, the identity gate and every place that assumes a pubkey exists (world sync, notifications, objectives claims, sharing, the public page). Estimated as the four planned steps or a little more. Risk: two code paths for "who am I" for the life of the game.

### Option B (recommended): keep instant play, fix what's left

Keep today's one-click guest key, and target the two remaining problems directly:

1. **Hide abandoned airlines.** The world map, rival lists and leaderboard skip airlines with no active route whose last activity is more than 7 days old (from the action log / snapshot `lastTick`). They stay on relays, and come back the moment they act again. Pure filter, unit-tested.
2. **Make keeping the airline easy.** Show the existing backup prompt at the right moment (after the first landing, then on the first return visit) instead of only as a banner, with one-tap "copy my key" and "download key file".
3. **Optional:** a `?demo` read-only tour for people who want to look before they play (a sample airline replayed locally), if the S04 funnel shows people bouncing before "Play for free".

- **Cost:** small, about two steps, no new identity path.
- **Trade-off:** guests still publish from their first action. That's fine for a decentralised world, and abandoned airlines no longer clutter it.

### Owner's decision (2026-10-07)

Option B.

### Recommendation

**Option B.** The friction S26 was written to remove is already gone, and option A's cost and permanent second identity path buy little more than B. If the funnel later shows guests dropping before "Play for free", add the `?demo` tour, not a full sandbox.

## Handoff notes

- **Shipped (option B):**
  - Abandoned airlines (no active route, idle more than 7 days) drop out of the shared world: the map, rival lists and the leaderboard. They come back the moment they act again.
  - Guests get a one-time "keep your airline" card after their first landing and again on their first return visit. It copies or downloads the key in one tap, in en and es.
- **Not shipped:**
  - Option A, the full local sandbox. The owner chose B; A stays designed under Decisions.
  - The `?demo` tour, which waits on funnel evidence.
- **Gotchas:**
  - World sync filters per snapshot using max(`lastTick`, snapshot tick). An airline with unknown activity is never treated as abandoned.
  - Prompt state lives in localStorage (shown) and sessionStorage (the current visit) per pubkey, under `acars:backup-prompt:*`.
  - e2e route launches must wait for the "is live" toast (see the S26.3 log line).
