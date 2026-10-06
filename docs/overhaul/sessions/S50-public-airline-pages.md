# S50 — Public airline pages + dynamic OG images

> **Status:** ◐ in progress
> **Next step:** S50.3
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
>
> **Track:** Growth · **Size:** M (3 steps) · **Depends on:** S20 · **Unblocks:** S51
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Every airline has a shareable page that previews beautifully anywhere.

## Why (evidence)

- Ledger A16; audit T2/T3.

## Read first

- `functions/` (Cloudflare Pages Functions)
- `packages/nostr` (reading an airline's snapshot)
- `routes/` (add `/airline/$npub`)

## In scope

- `/airline/$npub` route: route map, livery, key stats, "Start your own airline" CTA
- Pages Function that serves OG meta and a generated OG image (route map + livery + stats) for crawlers, cached

## Out of scope

- Posting (S51).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S50.1** `/airline/$npub` client page. _Done when:_ screenshots.
- [x] **S50.2** Pages Function serving OG meta to crawlers. _Done when:_ validator passes.
- [ ] **S50.3** Generated OG image + edge cache + fallback. _Done when:_ image renders for a real airline.

## Details & guidance

- Read from relays at the edge with a short cache; no new persistent storage.
- Fallback image when data is unavailable.

## Acceptance criteria

- [ ] The OG card renders in a validator for a real airline; page Lighthouse SEO ≥ 90.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S50.1 · (this commit) · Public airline page. New route `/airline/$npub`; it also accepts a 64-hex key, and an invalid key shows a message. `PublicAirlinePage` shows:

- the airline from my own state, or from world state (`competitors`, `routesByOwner`, `fleetByOwner`), calling `syncCompetitor` when it isn't loaded yet; it shows a loading state, then 'not found';
- a livery-gradient header with ICAO, name, aircraft, routes, tier and revenue;
- Share (share sheet, or copy the link);
- a 'Start your own airline' call to action (`/join`) for anyone but the owner;
- an SVG route map and up to 8 livery tiles.

Supporting changes:

- **Route map.** Pure `routeMap.ts` `projectRouteMap`: equirectangular, fitted to the network with an 8° minimum span. It's dependency-free so the OG function can reuse it.
- **Keys.** `airlineKey.ts` `parseAirlineKey` / `airlineNpub` / `airlinePath`.
- **Entry point.** Leaderboard rows get a 'Page' link; the context bar maps `/airline/`.
- **i18n.** en and es strings in `publicAirline.*` and `workspace.airline*`.
- **Tests.** Unit tests; e2e `public-airline.spec.ts` (player: leaderboard → own page with a map line; guest: unknown key → call to action). I checked a screenshot by eye.
  2026-10-06 · S50.2 · (this commit) · OG meta for crawlers. New Pages Function `functions/airline/[npub].ts` (`onRequestGet`) serves `index.html` (via `ASSETS`) with the airline's title, description, canonical URL, Open Graph and Twitter tags, so the SPA still boots.
- **Data.** The latest checkpoint event (kind 30078, checkpoint d-tag) is read over WebSocket from nostr.acars.pub, then damus, then nos.lol, with 2.5 s each. It's summarized and cached in `caches.default`: 10 min when found, 1 min when missing.
- **Fallback.** Any failure, a bad key or a missing airline gives a generic ACARS card, never an error.
- **Shared code.** Pure helpers live in `apps/web/src/features/airline/utils/ogMeta.ts` and the function imports them: a dependency-free bech32 npub decoder (tested against nostr-tools), a checkpoint summarizer, `latestSummary`, `buildAirlineMeta` and an HTML-escaping `injectMeta` (tested against the real index.html). `og:image` points at `/api/og/airline/<npub>` (S50.3). `WORLD_ID` is now exported from `@acars/nostr` so a test pins the d-tag.
- **Tests.** Handler, relay reader (fake socket: EOSE, timeout, close, fetch failure), relay fallback order and the Pages wiring (cache miss and hit).
- **Pending: validator run.** The agent container can't reach pages.dev, acars.pub or relays (network policy). Check the branch preview `https://claude-zen-darwin-3op878.acars.pages.dev/airline/<npub>` with a card validator (e.g. opengraph.xyz).

## Follow-ups

- Relay events in the OG function aren't signature-verified (the function stays dependency-free). A relay could serve a forged checkpoint for a preview. The impact is cosmetic and limited to link previews; add schnorr verification if previews ever show anything sensitive.

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
