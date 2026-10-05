# S26 — Guest sandbox airline

> **Status:** ☐ not started
> **Next step:** S26.1
> **Branch:** —
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

- [ ] **S26.1** Write the sandbox time-mapping design in this brief (Follow-ups → Decisions). _Done when:_ owner can review.
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

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
