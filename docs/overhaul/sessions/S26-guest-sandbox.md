# S26 — Guest sandbox airline

> **Status:** ◐ in progress
> **Next step:** owner decision on the design below (option A or B), then S26.2
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
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
- [ ] **S26.2** Sandbox store mode: local action log through the same reducer. _Done when:_ unit tests.
- [ ] **S26.3** Guest UI enters sandbox automatically. _Done when:_ guest can launch a route.
- [ ] **S26.4** Save flow: create key, publish in order, recover from failures + tests. _Done when:_ replayed network identical.

## Details & guidance

- Decide and document how sandbox time maps on save (recommended: actions are replayed at save time; sandbox earnings aren't carried over, only the network setup).
- Tests for save replay and failure recovery.

## Acceptance criteria

- [ ] A guest can open a route and see a plane take off with no identity; save produces an identical network on relays.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · S26.1 · (this commit) · **Design written for review** (see Decisions below). Recommends option B (the lighter path) because S20/S21 already removed most of the friction this session was written for; option A, the full sandbox, is designed in detail in case the owner prefers it. Waiting on the owner's choice before S26.2.

## Follow-ups

_None yet._

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

### Recommendation

**Option B.** The friction S26 was written to remove is already gone, and option A's cost and permanent second identity path buy little more than B. If the funnel later shows guests dropping before "Play for free", add the `?demo` tour, not a full sandbox.

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
