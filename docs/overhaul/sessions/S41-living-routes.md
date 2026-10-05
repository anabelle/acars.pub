# S41 — Living routes

> **Status:** ☐ not started · **Track:** Graphics · **Size:** M · **Depends on:** S40 · **Unblocks:** S42
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

## Goal

Routes show the business: color by profit, width by frequency, motion by direction.

## Why (evidence)

- Audit §2.8: routes are static flat lines.

## Read first

- `packages/map/src/layers/*` (after S40)
- store selectors for route profit (cockpit computes strongest/weakest)

## In scope

- Data-driven line color (profit/hour → green to red), width (weekly frequency), animated dash flow
- Rival routes thinner, in their livery color; a "my network / world" toggle

## Out of scope

- 3D arcs (S45).

## Tasks

- All styling via feature properties and expressions (no per-frame JS loops over routes).
- Legend chip in the map corner.

## Acceptance criteria

- [ ] Screenshots; frame-time unchanged within 10% vs S40 numbers.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
