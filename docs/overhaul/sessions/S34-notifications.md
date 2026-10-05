# S34 — PWA + notifications

> **Status:** ☐ not started · **Track:** Loop · **Size:** M · **Depends on:** decision D3 · **Unblocks:** S52 · **Gated by D3**
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Keep the CSP correct for the SW.
- An offline shell shows the last known state with an "offline – changes queued" banner (ties into S22).

## Acceptance criteria

- [ ] Lighthouse PWA installable; notification for a simulated grounding in a test.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
