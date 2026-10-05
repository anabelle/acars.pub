# S51 — Share loop + milestone posts

> **Status:** ☐ not started
> **Next step:** S51.1
> **Branch:** —
> **PR:** —
>
> **Track:** Growth · **Size:** M (3 steps) · **Depends on:** S44, S50, decision D6 for referral rewards · **Unblocks:** — · **Gated by D6 (referral reward only)**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Players naturally share their network, liveries and milestones, and shares bring new players.

## Why (evidence)

- Audit T3: nothing to share.

## Read first

- S44 poster code
- S50 public page
- `packages/nostr` publishing

## In scope

- "Share my network" (image + public page link) via the Web Share API with copy-link fallback
- Opt-in milestone posts (tier-up, first jet) as Nostr kind 1 notes with the image
- Referral link `?ref=<npub>`, with attribution recorded in `AIRLINE_CREATE` (reward per D6, ruleset-gated)

## Out of scope

- Paid campaigns.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S51.1** "Share my network" via Web Share + copy fallback. _Done when:_ works on mobile + desktop.
- [ ] **S51.2** Opt-in milestone kind-1 posts with preview. _Done when:_ post appears on relays.
- [ ] **S51.3** Referral `?ref=` attribution (reward only if D6 decided). _Done when:_ attribution in S04 report.

## Details & guidance

- Every post is opt-in and previewed before publishing.
- en + es.

## Acceptance criteria

- [ ] Share flows work on mobile and desktop; referral attribution appears in the S04 report.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
