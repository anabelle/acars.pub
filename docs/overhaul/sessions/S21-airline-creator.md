# S21 — Quick-start airline creator

> **Status:** ☑ ready for review
> **Next step:** — (all steps done; awaiting review)
> **Branch:** claude/zen-darwin-3op878
> **PR:** https://github.com/anabelle/acars.pub/pull/166
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
- [x] **S21.2** Three instant hub suggestions with reasons and costs. _Done when:_ unit tests for suggestion picker.
- [x] **S21.3** Real relay-state badge. _Done when:_ badge test with relays stubbed down.
- [x] **S21.4** Key backup moved to post-first-landing banner. _Done when:_ screenshots.

## Details & guidance

- Auto-generate ICAO, callsign and livery colors from the name (still unique-checked); put them behind a "Customize" disclosure.
- Show three hub suggestions instantly (nearest by geolocation/time zone + a big market + a cheap one), each with a one-line reason and its open/monthly cost.
- Replace the static "Connected" badge with real relay state (connecting / ready / offline with retry).
- Move key backup out of the form into the post-first-landing "Secure your airline" banner.
- en + es.

## Acceptance criteria

- [x] The form needs ≤ 2 inputs to submit.
- [x] Badge reflects real state in a test with relays stubbed down.

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
- 2026-10-05 · S21.2 · (this commit) · **Three one-click hub suggestions** with reasons and costs.
  - `@acars/data` `suggestStarterHubs(lat, lon, current, airports, occupied, tier)` returns:
    - the preselected big market (`findPreferredHub`),
    - the closest airport **in another city**,
    - the cheapest hub to run (the most populous regional-fee airport of another city in the same country).
  - Occupied airports, duplicates and second airfields of a city already offered are skipped. The first version offered Madrid's Torrejón and Cuatro Vientos airfields as alternatives to MAD; caught in the browser check.
  - `StarterHubChoices` cards (reason, IATA, city, "$X setup · $Y/mo") sit above "Pick a Different Hub". The list is anchored to the player's first detected location: picking a hub moves the stored location, which would otherwise reshuffle the cards (also caught in the browser).
  - From Madrid: MAD (biggest market, $2M + $400k/mo), SLM Salamanca (closest), GRO Girona (cheapest, $250k + $50k/mo). Clicking a card selects it.
  - Copy updated ("Just pick a name…", "Name your airline and pick a home hub…"). en + es. 4 suggestion tests. Gate + 18 e2e green.
- 2026-10-05 · S21.3 · (this commit) · **Real relay-state badge.**
  - `useRelayHealth` now also returns `status`: `connecting` with no relay during the first ~10 s (2 polls), `ready` with ≥1 relay, `offline` after that. It also returns `retry()` (calls `reconnectIfNeeded`) and `retrying`. The existing auto-reconnect and `isConnected` are unchanged for Topbar/Cockpit.
  - `shared/components/RelayStatusBadge`: "Connected to N relays" / "Connecting to relays…" / "Offline" with a Retry button. It replaces the creator's hard-coded "Connected - create your airline" (ledger A10). en + es.
  - 3 tests with `@acars/nostr` stubbed: connecting → offline with retry (relays stay down); ready with the count once relays connect; recovers from offline when a retry connects.
  - Gate + 18 e2e green.
- 2026-10-05 · S21.4 · (this commit) · **Key backup moved to after the first landing.**
  - `SecurityUpgradeBanner` shows only once the airline has revenue (revenue accrues only on landings; an O(1) check). New copy: "Your airline just flew its first flight. Secure it: back up your key so a cleared browser can't take it away." The existing "Secure it" actions are unchanged.
  - The creator no longer carries the "Account key" button or the backup tools, so the form is just name + hub (+ optional Customize).
  - Tests: the banner waits for the first landing and shows once the airline has flown; the creator shows no key tools even for ephemeral identities.
  - Screenshots via a clock-driven e2e run: no banner after signup; after launching MAD→BCN and fast-forwarding 2 h, the away report shows 1 flight, and closing it reveals the banner.
  - Also: the suggested callsign skips one- and two-letter fragments ("E2E Air" gave "E", now "AIR").
  - Gate + 18 e2e green.

## Follow-ups

- **Topbar "Account key" button:** the shell still offers key tools in the top bar for ephemeral accounts before the first landing. That's fine as an opt-in, but S22 (shell clarity) could fold it into the same "Secure your airline" flow.
- **Unused i18n keys:** `creator.connectedSubtitle`, `creator.icaoPlaceholder`, `creator.callsignSuggested` and `creator.callsignDefaultIcao` are no longer used; remove them with the i18n parity test (S30 follow-up).

## Handoff notes

**Shipped:** creating an airline takes a name and a hub.

- The ICAO code (unique-checked), callsign and livery colors are suggested from the name, under a collapsed "Customize".
- Three one-click hubs (biggest market, closest other city, cheapest to run) show their setup and monthly costs.
- The header badge shows the real relay state, with a retry.
- Key backup waits until the first landing.
- The `createAirline` payload is unchanged.

**Gotchas:**

- The e2e signup helper (`e2e/signup.ts#createAirline`) now types only the name. Specs that need a specific ICAO must open "Customize" first.
- `StarterHubChoices` anchors its suggestions on the player's first detected location. If a feature changes `userLocation` on purpose and wants new suggestions, remount it.
