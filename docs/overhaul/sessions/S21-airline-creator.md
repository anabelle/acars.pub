# S21 — Quick-start airline creator

> **Status:** ☐ not started
> **Next step:** S21.1
> **Branch:** —
> **PR:** —
>
> **Track:** UX · **Size:** M (4 steps) · **Depends on:** — · **Unblocks:** S26
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

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

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [ ] **S21.1** Auto-generated ICAO/callsign/colors behind "Customize". _Done when:_ form submits with name + hub only.
- [ ] **S21.2** Three instant hub suggestions with reasons and costs. _Done when:_ unit tests for suggestion picker.
- [ ] **S21.3** Real relay-state badge. _Done when:_ badge test with relays stubbed down.
- [ ] **S21.4** Key backup moved to post-first-landing banner. _Done when:_ screenshots.

## Details & guidance

- Auto-generate ICAO, callsign and livery colors from the name (still unique-checked); put them behind a "Customize" disclosure.
- Show three hub suggestions instantly (nearest by geolocation/time zone + a big market + a cheap one), each with a one-line reason and its open/monthly cost.
- Replace the static "Connected" badge with real relay state (connecting / ready / offline with retry).
- Move key backup out of the form into the post-first-landing "Secure your airline" banner.
- en + es.

## Acceptance criteria

- [ ] The form needs ≤ 2 inputs to submit.
- [ ] Badge reflects real state in a test with relays stubbed down.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

_No entries yet._

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
