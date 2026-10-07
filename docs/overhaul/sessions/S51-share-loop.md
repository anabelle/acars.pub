# S51 — Share loop + milestone posts

> **Status:** ☑ ready for review
> **Next step:** — (awaiting merge of #185)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #185
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
- [x] **S51.2** Opt-in milestone kind-1 posts with preview. _Done when:_ post appears on relays.
- [x] **S51.3** Referral `?ref=` attribution (reward only if D6 decided). _Done when:_ attribution in S04 report.

## Details & guidance

- Every post is opt-in and previewed before publishing.
- en + es.

## Acceptance criteria

- [x] Share flows work on mobile and desktop; referral attribution appears in the S04 report.

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

2026-10-07 · S51.2 · (this commit) · **Opt-in milestone posts.**

- **Nostr.** `packages/nostr/src/notes.ts`:
  - `buildMilestoneNote` (pure): the content holds the text, the image URL (so every client shows it), the airline page link and `#acars #aviation`; the tags are `t` hashtags, an `r` link and a NIP-92 `imeta` for the image.
  - `publishNote` signs and publishes a kind-1 note, with the usual publish retry.
- **Composer.** `MilestonePostDialog` previews an editable text (en/es default per milestone) and the network card image, with an "Include the network image" checkbox. Nothing is published until the player presses "Post to Nostr". It then uploads the image to Blossom (the existing uploader), builds the note and publishes it. The Nostr code loads only on post (`notePoster.ts`).
- **Entry points:**
  - the tier-up celebration gains "Share this milestone";
  - the first jet joining the fleet (any non-turboprop: A220, E-Jets and up) shows a toast with a "Post it" action (`firstJetAdded`, pure);
  - neither posts by itself.
- **Tests:**
  - note content and tags, kind-1 publish, signer required;
  - first-jet detection;
  - the dialog: preview, edit, post with image, post without image, failure toast, Spanish;
  - celebrations: the tier-up share opens the composer, and the first jet toasts once, with its action.
- **No e2e.** The full flow isn't covered end to end. Tier 1 can only buy turboprops, so the first jet comes with tier 2, which needs about $5M in revenue: out of reach for an e2e run. The fake relay and the sandbox's lack of network also rule out a real relay check here.

2026-10-07 · S51.3 · (this commit) · **Referral attribution.**

- **Capture.** `apps/web/src/features/share/referral.ts`: at startup, `captureReferral` stores the first `?ref=<npub|hex>` seen on the device (first touch wins; blocked storage is harmless). `readReferral` never returns the player themself.
- **Creation.** `AirlineCreator` passes the referrer, and `createAirline` adds `payload.referrer` (hex) to `AIRLINE_CREATE`, attribution only. The replay ignores it; the action chain hashes it like the rest of the payload.
- **Share links carry `?ref=`.** "Share my network" and milestone posts link to your page with your own `?ref=`, so visitors who start an airline credit you.
- **Funnel (S04).** `parseFunnelEvent` reads a valid hex referrer from `AIRLINE_CREATE` (never self), and journeys hold it in memory. The report gains a **Referrals** section: referred airlines out of all created, distinct referring players, and how far the referred got (route, assignment, D1, D7). Counts only, never pubkeys (a test checks).
- **Not shipped: the referral reward.** D6 makes rewards replay-verified, but a reward claimed by the referrer would need the referred player's log inside the referrer's replay, which clients don't load. Logged as a follow-up that needs a design (e.g. the reward claimed in the referred player's own log).
- **Tests:**
  - capture: npub/hex, first touch wins, malformed, blocked storage; never self; link building;
  - funnel: parsing, journeys, the report section, the empty case;
  - e2e `referral.spec.ts`: arriving through `/?ref=npub…`, the published `AIRLINE_CREATE` carries the referrer;
  - the share e2e specs now expect `?ref=` on the shared link.

## Follow-ups

- Referral reward (D6-compatible design: e.g. a claim in the referred player's own log once they reach a milestone, crediting both).
- An e2e for milestone posts once there is a test hook to seed an airline at a higher tier (or a debug "simulate tier-up").

## Handoff notes

- **Shipped:**
  - "Share my network": the network card image plus the public link, via the share sheet or a copied link with the image to download; mobile and desktop e2e.
  - Opt-in, previewed milestone posts: kind-1 notes for tier-ups and the first jet, with the image on Blossom.
  - Referral attribution through `?ref=`, from `AIRLINE_CREATE` to the funnel report.
- **Not shipped:** the referral reward (cross-log verification design needed) and an e2e for milestone posts (needs a higher-tier test airline). See Follow-ups.
- **Gotchas:**
  - jsdom has no `URL.createObjectURL`; stub it in component tests that preview images.
  - Rendering the network PNG takes about a second under jsdom; give share assertions more than the default `waitFor` timeout.
  - The Nostr package is loaded only when posting (`notePoster.ts`); keep it out of static imports in root-mounted components.
