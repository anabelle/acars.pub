# S72 — Ranked entry (proof of work first)

> **Status:** ☑ merged
> **Next step:** — (merged in #201)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #201 (with S68–S71)
>
> **Track:** Social · **Size:** M (4 steps) · **Depends on:** D15 ✅ (2026-10-12: "computer work first") · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §4 Social, §5 game theory ("Free keys → Sybil dumping")

> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Keys are free, so anyone can spin up a throwaway airline that dumps fares on your routes and walks away. A ranked airline has done a little computer work once (a few seconds); unranked airlines still play, but they can't undercut anyone and don't appear in the ranking.

## Design

- **The proof (Nostr, NIP-13):** one addressable event per player — kind 30078, `d = airtr:world:<world>:rank`, a `nonce` tag — whose id has at least `RANKED_POW_BITS` (18) leading zero bits: ~260 k hashes on average, seconds in a browser. It is signed, so nobody can claim someone else's work, and it is independent of the action log and snapshots (which are self-reported).
- **Mining:** in the browser, in chunks that yield to the UI, with progress and cancel. Mined once; never repeated.
- **Verification:** clients load proofs for the airlines they see (one query for many authors), check the signature, author, d-tag and bits. No proof (or a weak one) → unranked. Missing data reads as unranked, never as a crash.
- **What ranked changes:**
  - **Anti-dumping:** an unranked rival's fares count as at least the suggested fare in everyone else's market share (`unrankedOffer`). They compete on schedule and service, not by dumping. Your own economics are unchanged by your rank.
  - **Ranking:** the leaderboard marks ranked airlines and ranks them first; unranked ones are listed after, marked.
- **Visible:** a "Get ranked" card (cockpit) with what it does, progress while mining, and the badge after.
- **Bounded:** one proof per player, one batched query; the floor is one comparison per rival offer.
- **Later (not here):** sats stakes for prize leagues (D15 "sats for prize leagues"), seasons.

## Steps (checkpoints)

- [x] **S72.1** Core: `powBits`, `RANKED_POW_BITS`, `isRankedId`, `unrankedOffer`; tests.
- [x] **S72.2** Nostr: rank proof template, chunked miner with progress/cancel, strict parser/verifier, publish and batched load; tests.
- [x] **S72.3** Store: rank store (ranked set, own status, mining), registry floors unranked rivals; tests.
- [x] **S72.4** Web: "Get ranked" card, leaderboard badge and order; i18n; e2e (desktop and phone), screenshots, PR.

## Progress log

2026-10-12 · brief · (this commit) · Written after the owner's D15 "computer work first". Chose a separate signed proof event over a flag in the airline state: snapshots and action payloads are self-reported, a signed NIP-13 event is not.

2026-10-12 · S72.1 · (this commit) · **Rank rules, in core.** `ranked.ts`: `RANKED_POW_BITS` = 18, `powBits` (NIP-13 leading zero bits of a hex id; stops at the first non-hex character), `isRankedId` (64 hex chars and enough bits), `unrankedOffer` (fares, announced ones included, no lower than the suggested fare for the distance; higher fares and the schedule untouched). 4 tests; core 458/458, 100 % functions.

2026-10-12 · S72.2 · (this commit) · **Proofs on Nostr.** `rankProof.ts` (pure): `RANK_D_TAG` (`airtr:world:v6-beta:rank`), `rankTemplate` (nonce tag commits to the bits), `mineRankProof` (nostr-tools `getEventHash`, yields every `chunk` hashes, progress, abort), `parseRankProof` (kind, d-tag, committed bits ≥ bar, id bits ≥ bar, `verifyEvent` for id and signature). `rank.ts`: `loadRankProofs` (one query per 200 authors, only the asked authors count) and `publishRankProof` (signs with the player's signer, refuses if signing changed the id). Tests mine at 6–8 bits; forged signatures, other authors, weak commitments, wrong kind/d-tag rejected (tests use wire copies: nostr-tools caches verification on the object). Nostr 143/143, coverage 88.3 %.

2026-10-12 · S72.3 · (this commit) · **Rank in the game.** `rank.ts` (store): `useRankStore` (ranked set, `loaded`, own `status`/`hashes`), `isRankedAirline` (everyone counts as ranked until proofs have loaded once, so a slow relay never floors every rival), `getRanked` (mine with progress → publish → ranked; one miner at a time; cancel → unranked, errors → failed) and `cancelRankMining`. `offersInForce` floors unranked rivals' offers with `unrankedOffer` (registry offers now carry `distanceKm`; offers without it are left alone). Tests: store transitions, mining success/cancel/failure, the floor. Store 317/317.

2026-10-12 · S72.4 · d85634e (+ this commit for the docs) · **Ranked, on screen.**

- `RankBridge` (root): loads proofs for the player and every rival, every 10 minutes and again whenever the player's key or the rival count changes (the first e2e run showed it mounting before the key existed).
- `GetRanked` (top of the leaderboard): what it does and why ("…throwaway airlines can't dump fares on you"), "Get ranked (a few seconds)", live tries with Cancel, "Publishing your proof…", a retry line on failure, then "Ranked: your airline counts in the ranking."
- Leaderboard: ranked airlines first (`rankedFirst`, each part in the metric's order), a Ranked / Unranked badge per row once proofs have loaded.
- i18n en/es `rank.*`. Tests: card states, bridge (keys, reload, failure), order. Web 708/708.
- e2e `ranked-entry.spec.ts` (1440) and `mobile-ranked-entry.spec.ts` (390): a Madrid airline opens a route, the card offers ranking, real 18-bit mining runs in the page and publishes to the fake relay, the card and the row turn Ranked. Screenshots: `media/s72/get-ranked-{1440,390}.png`, `media/s72/ranked-{1440,390}.png`. Ships in #201 (same branch).

2026-10-12 · merged · — · Merged in #201 (with S68–S74).
