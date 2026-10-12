# S74 — Social: delivery posts, rivalry notes, friends league

> **Status:** ◐ in progress
> **Next step:** S74.2 — web: post preview; delivery reveal post; rivalry note with the daily limit
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** — (next)
>
> **Track:** Social · **Size:** M (4 steps) · **Depends on:** D18 ✅ (2026-10-12: "yes, opt-in only"), S61, S51 · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §4 Social

> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

The proud moments travel: a new plane's livery reveal becomes a picture post that image-first Nostr clients show and people can zap; entering a rival's market can be announced; and the ranking can show just the airlines of the people you follow. Nothing is ever posted without the player pressing Post.

## Design

- **Delivery posts (NIP-68):** in the delivery ceremony, when the plane has a published livery image, "Post the reveal" opens a preview with editable text; Post publishes a kind 20 picture event (`title`, `imeta` with url, mime and alt, `t` hashtags, the airline page link).
- **Rivalry notes:** on a route card whose market has rivals, "Announce your entry" opens the same preview with "{airline} enters {city}: {origin} → {destination}." as a kind 1 note (hashtags, link). Rate-limited to 3 a UTC day per browser.
- **Friends league:** the leaderboard gains "Everyone / People I follow"; follows come from the player's latest NIP-02 contact list (kind 3), loaded once when the filter is first chosen.
- **Guardrail:** only these opt-in posts go to public relays; game state stays where it is. Every post needs a press of Post, from a preview the player can edit or cancel.
- **Later:** NIP-58 badges (need an issuer key the owner controls), the weekly Aviation Ledger (NIP-23), livery zaps nudging brand.

## Steps (checkpoints)

- [x] **S74.1** Nostr: `buildPictureNote`, `buildRivalryNote`, `publishNote` for kind 1 or 20, `loadFollows`; tests.
- [ ] **S74.2** Web: post preview dialog; delivery reveal post; rivalry note with the daily limit; i18n; tests.
- [ ] **S74.3** Web: friends league filter on the leaderboard; tests.
- [ ] **S74.4** e2e (desktop and phone), screenshots, PR.

## Progress log

2026-10-12 · brief · (this commit) · Written after the owner's D18 "yes, opt-in only" and a read of the S51 milestone posts (preview, Blossom upload, kind 1 publish) and the S61 delivery ceremony.

2026-10-12 · S74.1 · (this commit) · **Posts and follows, in nostr.** `notes.ts`: `NoteDraft.kind` (1 or 20; `publishNote` honours it), `buildPictureNote` (NIP-68: `title`, `imeta` url/mime from the extension/alt, hashtags, link in the content), `buildRivalryNote` (kind 1 like the milestone notes). `follows.ts`: `loadFollows` (the author's newest kind 3, valid `p` keys only). Tests for all; nostr 147/147, coverage 88.5 %.
