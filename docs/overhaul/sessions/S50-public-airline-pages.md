# S50 — Public airline pages + dynamic OG images

> **Status:** ☐ not started
> **Next step:** S50.1
> **Branch:** —
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

- [ ] **S50.1** `/airline/$npub` client page. _Done when:_ screenshots.
- [ ] **S50.2** Pages Function serving OG meta to crawlers. _Done when:_ validator passes.
- [ ] **S50.3** Generated OG image + edge cache + fallback. _Done when:_ image renders for a real airline.

## Details & guidance

- Read from relays at the edge with a short cache; no new persistent storage.
- Fallback image when data is unavailable.

## Acceptance criteria

- [ ] The OG card renders in a validator for a real airline; page Lighthouse SEO ≥ 90.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
