# S20 — Front door: honest landing, entry layout, meta

> **Status:** ☐ not started · **Track:** UX · **Size:** M · **Depends on:** — · **Unblocks:** S22, S50
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Guest home: map-first with one small card ("Start your airline") instead of the instruction essay.
- Key import becomes a quiet text link ("Already have a Nostr key?").
- en + es strings.

## Acceptance criteria

- [ ] S01 overlap test passes.
- [ ] 390 and 1440 screenshots in the PR.
- [ ] The OG card validates (use a validator site or `og:` tag unit test).

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
