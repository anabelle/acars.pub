# S20 — Front door: honest landing, entry layout, meta

> **Status:** ☐ not started
> **Next step:** S20.1
> **Branch:** —
> **PR:** —
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

- [ ] **S20.1** Fix mobile context-bar overlap (flip S01 `test.fail` if present). _Done when:_ overlap spec passes.
- [ ] **S20.2** `index.html` title/description/OG/Twitter + `public/og.png`. _Done when:_ tags present; validator passes.
- [ ] **S20.3** Guest/`/join` entry layout: no sidebar, single CTA, quiet key-import link. _Done when:_ screenshots at both sizes.
- [ ] **S20.4** Honest landing copy + "Roadmap" strip (en + es). _Done when:_ no unshipped feature presented as live.
- [ ] **S20.5** Map-first guest home card + locked-section copy without "Nostr wallet". _Done when:_ screenshots.

## Details & guidance

- Guest home: map-first with one small card ("Start your airline") instead of the instruction essay.
- Key import becomes a quiet text link ("Already have a Nostr key?").
- en + es strings.

## Acceptance criteria

- [ ] S01 overlap test passes.
- [ ] 390 and 1440 screenshots in the PR.
- [ ] The OG card validates (use a validator site or `og:` tag unit test).

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
