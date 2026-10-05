# S51 — Share loop + milestone posts

> **Status:** ☐ not started · **Track:** Growth · **Size:** M · **Depends on:** S44, S50, decision D6 for referral rewards · **Unblocks:** — · **Gated by D6 (referral reward only)**
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Every post is opt-in and previewed before publishing.
- en + es.

## Acceptance criteria

- [ ] Share flows work on mobile and desktop; referral attribution appears in the S04 report.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
