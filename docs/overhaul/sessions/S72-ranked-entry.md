# S72 — Ranked entry (proof of work first)

> **Status:** ◐ in progress
> **Next step:** S72.3 — store: rank store, mining, registry floors unranked rivals
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** — (next)
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
- [ ] **S72.3** Store: rank store (ranked set, own status, mining), registry floors unranked rivals; tests.
- [ ] **S72.4** Web: "Get ranked" card, leaderboard badge and order; i18n; e2e (desktop and phone), screenshots, PR.

## Progress log

2026-10-12 · brief · (this commit) · Written after the owner's D15 "computer work first". Chose a separate signed proof event over a flag in the airline state: snapshots and action payloads are self-reported, a signed NIP-13 event is not.

2026-10-12 · S72.1 · (this commit) · **Rank rules, in core.** `ranked.ts`: `RANKED_POW_BITS` = 18, `powBits` (NIP-13 leading zero bits of a hex id; stops at the first non-hex character), `isRankedId` (64 hex chars and enough bits), `unrankedOffer` (fares, announced ones included, no lower than the suggested fare for the distance; higher fares and the schedule untouched). 4 tests; core 458/458, 100 % functions.

2026-10-12 · S72.2 · (this commit) · **Proofs on Nostr.** `rankProof.ts` (pure): `RANK_D_TAG` (`airtr:world:v6-beta:rank`), `rankTemplate` (nonce tag commits to the bits), `mineRankProof` (nostr-tools `getEventHash`, yields every `chunk` hashes, progress, abort), `parseRankProof` (kind, d-tag, committed bits ≥ bar, id bits ≥ bar, `verifyEvent` for id and signature). `rank.ts`: `loadRankProofs` (one query per 200 authors, only the asked authors count) and `publishRankProof` (signs with the player's signer, refuses if signing changed the id). Tests mine at 6–8 bits; forged signatures, other authors, weak commitments, wrong kind/d-tag rejected (tests use wire copies: nostr-tools caches verification on the object). Nostr 143/143, coverage 88.3 %.
