# S22 — Shell clarity: naming, status bar, real health

> **Status:** ☑ ready for review
> **Next step:** — (all steps done; awaiting review)
> **Branch:** claude/zen-darwin-3op878
> **PR:** https://github.com/anabelle/acars.pub/pull/167
>
> **Track:** UX · **Size:** M (3 steps) · **Depends on:** S20 · **Unblocks:** S31
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

One name per place, a status bar that speaks player language, and health indicators that tell the truth.

## Why (evidence)

- Audit U6, U8; ledger A10 (static LIVE DATA).

## Read first

- `layout/Sidebar.tsx`, `Topbar.tsx`, `WorkspaceContextBar.tsx`
- `network/components/Ticker.tsx`
- `cockpit/components/OperationsCockpit.tsx`
- route files under `apps/web/src/routes`

## In scope

- Naming: Cockpit, Fleet, Routes, Rivals, Finance, Info (labels, mobile tabs, page titles); add URL aliases (`/routes`, `/rivals`, `/finance`, `/info`) and redirect old paths
- Ticker: UTC clock, next landing countdown, today's cash delta, "World economy" label, LIVE dot tied to relay health
- Cockpit: relay card only when degraded; rewrite copy in player language

## Out of scope

- Tier progress (S31).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S22.1** Unified names + URL aliases with redirects from old paths. _Done when:_ redirect tests green.
- [x] **S22.2** Ticker: UTC clock, next landing, cash delta, "World economy", real LIVE health. _Done when:_ LIVE dot amber when relays down.
- [x] **S22.3** Cockpit: relay card only when degraded + jargon-free copy (en + es). _Done when:_ screenshots.

## Details & guidance

- Keep old URLs working (redirects) so shared links don't break.
- Remove "signed actions", "world tape" and similar jargon from the cockpit strings.
- en + es.

## Acceptance criteria

- [x] Screenshots (CI `screenshots` artifact on #167, plus local player-cockpit checks); redirect tests (`e2e/url-aliases.spec.ts`); the LIVE dot goes amber with relays stubbed down (`e2e/ticker.spec.ts`).

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-05 · S22.1 · bb106d3 · Nav names are now Cockpit, Fleet, Routes, Rivals, Finance, Info on desktop, mobile and page titles (en + es; the separate mobile labels are gone). `/routes`, `/rivals`, `/finance` and `/info` redirect to `/network`, `/leaderboard`, `/corporate` and `/about`, keeping search params (`shared/lib/routeAliases.ts`). The old paths stay canonical, so existing links and tests are unaffected. Unit tests cover the mapping; `e2e/url-aliases.spec.ts` checks every redirect in the browser.
2026-10-05 · S22.2 · (this commit) · Ticker now shows: a LIVE dot that reads the real relay state (green Live, amber Connecting or Offline); the UTC clock instead of "Cycle N"; the player's next landing (destination and countdown); today's cash result (landing revenue minus costs and lease payments since UTC midnight); and "World economy". Helpers live in `network/utils/tickerFacts.ts`. The cash selector returns a primitive, so timeline writes re-render the ticker only when the number changes, and the granularity test still passes. `e2e/ticker.spec.ts` stubs every relay socket closed and checks that the dot turns amber or Offline.
2026-10-05 · S22.3 · (this commit) · The cockpit shows the Connection card and the "You're offline" alert only when relays are actually offline, not during the first seconds of connecting. An odd last card spans the row, so three cards leave no gap. Cockpit copy (en + es) and the context-bar descriptions and modes are rewritten in player language. A unit test fails if cockpit strings mention relay, signed action, tape, ledger, flywheel, yield, gauge or treasury. `mobile-layout.spec.ts` now finds the context bar by its new "View only" label.

## Follow-ups

- Ticker "Today" sums the capped timeline (1,000 events), so a very busy airline may see a partial day. A per-day ledger in the store would make it exact.

## Handoff notes

- **Shipped:**
  - One name per place: Cockpit, Fleet, Routes, Rivals, Finance, Info.
  - Alias URLs that redirect to the canonical paths. The old paths stay canonical, so no links break.
  - An honest status bar: real relay state, UTC clock, next landing, today's cash and "World economy".
  - A cockpit with no jargon that only talks about relays when they're down.
- **Gotchas:**
  - TanStack's typed `redirect` needs the search object cast (`as never`), because the alias routes have no `validateSearch` and the canonical route validates it anyway.
  - The ticker's cash selector must return a primitive; returning an object would re-render on every store write.
- **Not done:** the top bar still says "N relays online" and "Corporate balance". It is outside this brief's file list; worth a pass in S31 or a later polish session.
