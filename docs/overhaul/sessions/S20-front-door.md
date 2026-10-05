# S20 — Front door: honest landing, entry layout, meta

> **Status:** ☑ merged
> **Next step:** — (merged in #159)
> **Branch:** claude/zen-darwin-3op878
> **PR:** https://github.com/anabelle/acars.pub/pull/159
>
> **Track:** UX · **Size:** M (5 steps) · **Depends on:** — · **Unblocks:** S22, S50
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

A first visit that is clear, honest and fast: one brand mark, one call to action, no protocol jargon, and links that preview properly when shared.

## Why (evidence)

- Ledger A9 (unshipped promises), A12 (mobile overlap), A16 (no meta/OG; title "Corporate Console"), and audit U2/U3/U4.

## Read first

- `apps/web/src/routes/-join.lazy.tsx`, `__root.tsx`, `-index.lazy.tsx`
- `shared/components/layout/*` (Topbar, Sidebar, WorkspaceContextBar)
- `identity/components/GuestKeyOnboarding.tsx`, `IdentityGate.tsx`
- `i18n/locales/{en,es}/common.json`

## In scope

- Entry layout for guests and `/join`: no sidebar, no auth button cluster in the top bar, a single CTA
- Landing copy: lead with live flights, real routes and rivals; move IPO/M&A/P2P/Bitcoin into a "Roadmap" strip labelled as planned
- Fix the mobile context-bar overlap (flip S01's `test.fail`)
- `index.html`: real title, description, OG/Twitter tags with a static share image (`public/og.png`)
- Guest locked-section copy: drop "Nostr wallet" wording

## Out of scope

- Creator form (S21)
- Status bar (S22)

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S20.1** Fix mobile context-bar overlap (flip S01 `test.fail` if present). _Done when:_ overlap spec passes.
- [x] **S20.2** `index.html` title/description/OG/Twitter + `public/og.png`. _Done when:_ tags present; validator passes.
- [x] **S20.3** Guest/`/join` entry layout: no sidebar, single CTA, quiet key-import link. _Done when:_ screenshots at both sizes.
- [x] **S20.4** Honest landing copy + "Roadmap" strip (en + es). _Done when:_ no unshipped feature presented as live.
- [x] **S20.5** Map-first guest home card + locked-section copy without "Nostr wallet". _Done when:_ screenshots.

## Details & guidance

- Guest home: map-first with one small card ("Start your airline") instead of the instruction essay.
- Key import becomes a quiet text link ("Already have a Nostr key?").
- en + es strings.

## Acceptance criteria

- [x] S01 overlap test passes.
- [x] 390 and 1440 screenshots in the PR (CI `screenshots` artifact on #159).
- [x] The OG card validates (use a validator site or `og:` tag unit test). `e2e/meta.spec.ts`; re-check once deployed with a live validator.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

- 2026-10-05 · S20.1 · (this commit) · `WorkspaceContextBar` is now `hidden sm:block`. On phones the floating top bar sits at the top of the screen and the bottom nav already shows the section, while competitor and bankruptcy states have their own mobile surfaces (top bar and full-screen overlay), so nothing important is lost; S22 can add a compact mode chip if wanted. Rewrote `e2e/mobile-layout.spec.ts` without `test.fail`: it now asserts both bars exist (so a renamed label can't pass vacuously) and that any _visible_ context bar doesn't overlap. Verified: passes with the fix, and fails on the real overlap (y 0–38 vs 12–74) with the fix reverted. Desktop screenshot unchanged.
- 2026-10-05 · S20.2 · (this commit) · `index.html`: title "ACARS — Run a real airline on the real clock" (was "Corporate Console"), meta description, theme-color, canonical, Open Graph + Twitter `summary_large_image` tags with absolute `https://acars.pub/…` URLs. Fixed the favicon link, which pointed at a non-existent `/vite.svg`. `public/og.png` (1200×630, 312 KB) rendered from `scripts/og-image.html` via `node scripts/render-og-image.mjs`; copy only claims shipped things (live map, real routes and times, rivals, free, no ads, open source). `e2e/meta.spec.ts` checks tags, absolute URLs, and that `/og.png` (PNG, 1200×630) and `/favicon.svg` are served.
- 2026-10-05 · S20.3 · (this commit) · `/join` renders as a standalone **entry layout** (`ENTRY_ROUTES` in `routes/__root.tsx`): map in the background, no top bar, context bar, sidebar, mobile nav or ticker. One brand mark, one CTA ("Play for free"), quiet "I already have a Nostr account →" link. Desktop guest top bar elsewhere: one "Play Free" button plus a quiet "Already have a Nostr key?" link that reveals Browser wallet / nsec / What is Nostr? (`topbar.haveNostrKey`, en + es). **Deviation:** guests keep the sidebar on non-entry routes, since removing it would strand desktop guests without navigation to Rivals/Info; locked items stay dimmed (copy fixed in S20.5). Tests: root-route unit test for the entry layout; Topbar test clicks the disclosure; e2e `/join` entry-page spec (exactly one "play" button, no wallet button, no Fleet nav link). The `/join` mobile-overlap case was dropped since it has no top bar now. Screenshots: `/join` and `/` at 390 and 1440.
- 2026-10-05 · S20.4 · (this commit) · Honest landing copy (en + es). `/join` hero now describes the shipped game (live map, real routes and times, rivals, keeps flying while away, no ads or pay-to-win). Feature cards: "Run a real corporation" (IPO/takeovers) → **Real routes, real demand**; "Earn real Bitcoin" → **A real fleet** (35 aircraft, lease/buy, used market); "Compete globally" ("thousands of airlines, route marketplace") → **One shared live world**; "No servers" → "no central game server". New dashed **On the roadmap** strip ("Planned — not in the game yet"): public companies, Bitcoin rewards, alliances. Onboarding chip "Earn Bitcoin" → "No ads: no pay-to-win, no energy timers". About → Bitcoin & Lightning description prefixed "On the roadmap… Not in the game yet" (title kept; its test asserts it). New e2e check: no Bitcoin/IPO/takeover/sats/zaps text on `/join` outside the roadmap section.
- 2026-10-05 · S20.5 · (this commit) · Guest home card replaced: "Watch the world fly", one line (click any airport; start your airline, free, about a minute, no sign-up) and **one** CTA, "Start your airline" → `/join`. The cockpit link and essay are gone for guests; the 15-day dismissal is kept. Locked Fleet/Planning/Finance screens: player-facing titles ("Your hangar is waiting", "Your route network starts here", "Your airline's finances live here") and "Start your free airline to…" copy instead of "connect a Nostr wallet"; badge "Free to play" instead of "New to Nostr? Start here". `NostrAccessCard` now has one Play Free button with Browser wallet / nsec / What is Nostr? behind the quiet "Already have a Nostr key?" link (options shown directly when there's no free-play action). Mobile panel line `topbar.buildOnNostr` no longer says "start with a browser wallet". en + es. Tests updated (locked routes click the disclosure; home asserts the single `/join` link; the dismissal test asserts presence before closing; i18n test pins the new Spanish title).

## Follow-ups

_None yet._

## Handoff notes

**Shipped:** phone overlap fix; share metadata and preview image (`public/og.png`, regenerate with `node scripts/render-og-image.mjs`); `/join` as a chrome-free entry page; one call to action for guests everywhere (top bar, home card, locked screens), with existing-key sign-in behind a quiet "Already have a Nostr key?" link; honest landing copy with a labelled roadmap strip.

**Guards added (e2e):** mobile overlap regression; share metadata (`meta.spec.ts`); `/join` has exactly one play button and no shell; no Bitcoin/IPO/takeover claims on `/join` outside the roadmap.

**Deviations:** guests keep the desktop sidebar on non-entry routes (needed for navigation). The guest cockpit (`/?panel=cockpit`) still shows its instruction cards; not in this brief's steps. Candidate follow-up for S22/S31.

**For S21:** the creator form is unchanged and still asks for ICAO, callsign and colors up front.
**For S22:** the context bar is hidden on phones; if a mobile mode indicator (competitor/bankruptcy) is wanted, add a compact chip there.
**After deploy:** paste https://acars.pub into a live OG validator (e.g. opengraph.xyz) to confirm the card renders from the real domain.
