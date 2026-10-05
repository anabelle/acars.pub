# S21 — Quick-start airline creator

> **Status:** ☐ not started · **Track:** UX · **Size:** M · **Depends on:** — · **Unblocks:** S26
>
> Follow the session protocol in [`../README.md` §5](../README.md#5-session-protocol-every-session-follows-this).

## Goal

Name + hub → flying. Everything else is optional and editable later.

## Why (evidence)

- Ledger A10 (static "Connected"), A11 (Dakar for UTC users), audit U5.

## Read first

- `identity/components/AirlineCreator.tsx`, `HubPicker.tsx`, `SecurityUpgradeBanner.tsx`, `EphemeralKeyBackupActions.tsx`
- `app/AppInitializer.tsx` (hub suggestion)
- `packages/data/src/hubs.ts`

## In scope

- Creator form + hub suggestion UI

## Out of scope

- Changes to `createAirline` action payload semantics.

## Tasks

- Auto-generate ICAO, callsign and livery colors from the name (still unique-checked); put them behind a "Customize" disclosure.
- Show three hub suggestions instantly (nearest by geolocation/time zone + a big market + a cheap one), each with a one-line reason and its open/monthly cost.
- Replace the static "Connected" badge with real relay state (connecting / ready / offline with retry).
- Move key backup out of the form into the post-first-landing "Secure your airline" banner.
- en + es.

## Acceptance criteria

- [ ] The form needs ≤ 2 inputs to submit.
- [ ] Badge reflects real state in a test with relays stubbed down.

## Follow-ups

_None yet._

## Handoff notes

_To be filled in by the session that executes this brief: what shipped, what didn't, gotchas._
