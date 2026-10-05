# S34 — PWA + notifications

> **Status:** ☐ not started
> **Next step:** S34.1
> **Branch:** —
> **PR:** —
>
> **Track:** Loop · **Size:** M (4 steps) · **Depends on:** decision D3 · **Unblocks:** S52 · **Gated by D3**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Installable app and a reason to come back: alerts for groundings, tier-ups and rivals on your routes.

## Why (evidence)

- Ledger A17: no manifest, no service worker; design bible §2.2 notification hooks.

## Read first

- `apps/web/vite.config.ts`, `index.html` CSP
- `apps/web/capacitor.config.ts`

## In scope

- Web app manifest, icons, and a service worker (cache shell + static data catalogs)
- Per D3: Nostr DM notifier (recommended first) or a web push pipeline
- Settings UI for notification categories

## Out of scope

- Native push on Android (S52).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S34.1** Manifest + icons + installability. _Done when:_ Lighthouse installable.
- [ ] **S34.2** Service worker shell caching + offline banner. _Done when:_ offline reload shows last state.
- [ ] **S34.3** Notification pipeline per D3. _Done when:_ simulated grounding notifies.
- [ ] **S34.4** Notification settings UI (en + es). _Done when:_ screenshots.

## Details & guidance

- Keep the CSP correct for the SW.
- An offline shell shows the last known state with an "offline – changes queued" banner (ties into S22).

## Acceptance criteria

- [ ] Lighthouse PWA installable; notification for a simulated grounding in a test.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
