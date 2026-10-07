# S51 — Share loop + milestone posts

> **Status:** ◐ in progress
> **Next step:** S51.2
> **Branch:** `claude/zen-darwin-3op878`
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

- [x] **S51.1** "Share my network" via Web Share + copy fallback. _Done when:_ works on mobile + desktop.
- [ ] **S51.2** Opt-in milestone kind-1 posts with preview. _Done when:_ post appears on relays.
- [ ] **S51.3** Referral `?ref=` attribution (reward only if D6 decided). _Done when:_ attribution in S04 report.

## Details & guidance

- Every post is opt-in and previewed before publishing.
- en + es.

## Acceptance criteria

- [ ] Share flows work on mobile and desktop; referral attribution appears in the S04 report.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · S51.1 · (this commit) · **Share my network.**

- **Share module.** New `apps/web/src/features/share/shareNetwork.ts`:
  - `summaryFromState` builds the card input from the live airline (the same shape the S50 link preview builds from a checkpoint).
  - `shareNetwork` renders the network card PNG with the S50 rasteriser, then:
    - if the browser can share files (mostly mobile), sends the image, title, text and public link to the share sheet;
    - if it can only share links, sends the link;
    - with no share sheet (most desktops), copies the link and hands back the image.
  - A dismissed share sheet is a no-op; other share errors fall back to copying.
- **Button.** `ShareNetworkButton` sits in the cockpit header (own airline) and on your own public page. The public page's plain link share stays for other airlines. On the copy path, the "Link copied" toast offers "Download image".
- **Strings:** en/es.
- **Tests:**
  - unit: summary; each share path, including cancel and failure;
  - the public page: share sheet, copy with download action, failure;
  - e2e `share-network.spec.ts` (desktop): the link lands on the clipboard and the image downloads;
  - e2e `mobile-share-network.spec.ts` (mobile project): the share sheet receives the PNG (> 1 KB) and the `/airline/npub…` link.
- **Note.** D6 (replay-verified claims) is decided, so the S51.3 referral reward is no longer gated.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
