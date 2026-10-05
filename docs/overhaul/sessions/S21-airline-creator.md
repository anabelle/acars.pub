# S21 — Quick-start airline creator

> **Status:** ◐ in progress
> **Next step:** S21.2
> **Branch:** claude/zen-darwin-3op878
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

- [x] **S21.1** Auto-generated ICAO/callsign/colors behind "Customize". _Done when:_ form submits with name + hub only.
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

- [x] The form needs ≤ 2 inputs to submit.
- [ ] Badge reflects real state in a test with relays stubbed down.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

- 2026-10-05 · S21.1 · (this commit) · The creator needs only **a name and a hub**.
  - `utils/airlineIdentity.ts`:
    - `suggestIcaoCode(name, taken)`: initials or first letters, accents stripped. It skips codes other airlines use, with a name-seeded fallback that walks every code. E.g. Trans Atlantic Wings → TAW, Air Europa → AEU, Iberia → IBE (IBR if taken).
    - `suggestCallsign`: the name's first word (TRANS, IBERIA).
    - `suggestLivery`: name-hashed deep primary + complementary accent.
  - The form now shows: name → hub → a collapsed **"Customize code, callsign and colors"** `<details>`. Its summary shows the current code, callsign and swatches; fields left empty use the suggestions (placeholders show them). Submit needs only a name; the ICAO conflict check runs on the effective code.
  - `createAirline` payload unchanged (out of scope).
  - The e2e signup helper now types only the name, so all 18 e2e cover the 2-field path. Tests: 7 helper tests, creator test updated (name alone enables submit) plus a new test that the submit sends TAW / TRANS / a hex livery. en + es.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
