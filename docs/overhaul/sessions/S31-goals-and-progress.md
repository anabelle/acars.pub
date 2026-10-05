# S31 — First-hour checklist + tier progress

> **Status:** ☐ not started · **Track:** Loop · **Size:** M · **Depends on:** S22 (S12 for milestone data, optional) · **Unblocks:** —
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

## Goal

Always show the next goal: a guided first hour, then tier progress and milestones.

## Why (evidence)

- Audit §2.3/§2.4: no goals on screen; T-091 deferred; tier progress only in `/corporate`.

## Read first

- `cockpit/components/OperationsCockpit.tsx`
- `layout/Topbar.tsx`
- `packages/core/src/tier.ts`
- `routes/-corporate.lazy.tsx` (existing tier UI)

## In scope

- Checklist (open first route → first takeoff → first landing → adjust a fare → 3rd route) derived from state, each step deep-linked
- Compact tier progress in the top bar (revenue % and routes %)
- Milestone toasts and a celebration moment on tier-up (consumes S12 `MILESTONES` if merged; otherwise tiers only)

## Out of scope

- Changing thresholds (S12).

## Tasks

- Checklist state derives from airline state, not stored flags, so it's correct on any device.
- en + es.

## Acceptance criteria

- [ ] Screenshots of each checklist step; unit tests for step derivation.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
