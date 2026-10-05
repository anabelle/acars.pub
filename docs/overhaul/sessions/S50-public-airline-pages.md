# S50 — Public airline pages + dynamic OG images

> **Status:** ☐ not started · **Track:** Growth · **Size:** M · **Depends on:** S20 · **Unblocks:** S51
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

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

## Tasks

- Read from relays at the edge with a short cache; no new persistent storage.
- Fallback image when data is unavailable.

## Acceptance criteria

- [ ] The OG card renders in a validator for a real airline; page Lighthouse SEO ≥ 90.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
