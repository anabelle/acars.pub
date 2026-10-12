# S74 — Social: delivery posts, rivalry notes, friends league

> **Status:** ☑ done (awaiting merge)
> **Next step:** — (merge the PR)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #201 (with S68–S72)
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
- [x] **S74.2** Web: post preview dialog; delivery reveal post; rivalry note with the daily limit; i18n; tests.
- [x] **S74.3** Web: friends league filter on the leaderboard; tests.
- [x] **S74.4** e2e (desktop and phone), screenshots, PR.

## Progress log

2026-10-12 · brief · (this commit) · Written after the owner's D18 "yes, opt-in only" and a read of the S51 milestone posts (preview, Blossom upload, kind 1 publish) and the S61 delivery ceremony.

2026-10-12 · S74.1 · (this commit) · **Posts and follows, in nostr.** `notes.ts`: `NoteDraft.kind` (1 or 20; `publishNote` honours it), `buildPictureNote` (NIP-68: `title`, `imeta` url/mime from the extension/alt, hashtags, link in the content), `buildRivalryNote` (kind 1 like the milestone notes). `follows.ts`: `loadFollows` (the author's newest kind 3, valid `p` keys only). Tests for all; nostr 147/147, coverage 88.5 %.

2026-10-12 · S74.2 · (this commit) · **Posts, opt-in.**

- `SocialPostDialog` (share): title, editable text, the image when there is one, Cancel / Post; builds with the airline link (with referral) and publishes only on Post; failures keep the preview open with a toast.
- Delivery ceremony: "Post the reveal" when the plane's livery image is published → a NIP-68 picture post ("Meet Quetzal, our new ATR 72-600, home at PTY. #liveryreveal", alt "{type} in {airline} livery"). Escape closes the preview, not the ceremony.
- Route card, competition list (rivals present, your own airline only): `AnnounceEntry` → "{airline} enters {city}: {origin} → {destination}. Your move." as a kind 1 note; `rivalryLimit` keeps it to 3 a UTC day per browser and shows what's left.
- i18n en/es `socialPost.*`. Tests: dialog (edit, post, failure, no key), limit (count, reset, broken storage), announce (preview, count, limit), ceremony (button only with an image; Escape). Web 714/714.

2026-10-12 · S74.3 · (this commit) · **Friends league.** Leaderboard: "Everyone / People I follow" under the metric picker; `useFollows` loads the player's NIP-02 follows once, the first time the filter is chosen (a failed load reads as following nobody); the list keeps your own airline and the airlines whose CEO you follow, ranked-first order and metric kept; "Loading who you follow…" and "None of the people you follow fly yet. Share your airline with them." when empty. i18n en/es `leaderboard.league.*`. Tests: hook (once, off, keyless, failure), filter (loading, narrowing, empty). Web 717/717.

2026-10-12 · S74.4 · (this commit) · **On screen.** e2e `social-posts.spec.ts` (1440) and `mobile-social-posts.spec.ts` (390): a Madrid airline launches MAD → BCN; the painting "uploads" to a stubbed Blossom (PUT returns a descriptor, GET serves the image), so the delivered plane has a public livery URL; the ceremony offers "Post the reveal", the preview shows the text and image, Post publishes to the fake relay ("Posted to Nostr"); on the leaderboard "People I follow" keeps the player's own airline (a fresh key follows nobody). `livery.ts` now exports `PAINTING_BYTES`. The rivalry announcement needs a rival on the route and is covered by unit tests. Screenshots: `media/s74/reveal-post-{1440,390}.png`, `media/s74/friends-league-{1440,390}.png`. Ships in #201 (same branch).

2026-10-12 · S74 fix · (this commit) · The full coverage run caught an unhandled rejection from the new dialog test: its `@acars/nostr` mock lacked `ensureConnected`, which a store side effect imports. The mock is now partial (`importOriginal` plus overrides); web coverage run exits clean, 717/717.
