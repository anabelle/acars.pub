# S24 — Outcome-first fare editor + RouteManager i18n

> **Status:** ☑ merged
> **Next step:** — (merged in #168)
> **Branch:** claude/zen-darwin-3op878
> **PR:** https://github.com/anabelle/acars.pub/pull/168
>
> **Track:** UX · **Size:** M (4 steps) · **Depends on:** S23 · **Unblocks:** —
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Pricing shows consequences: projected LF and profit as you type, plus presets.

## Why (evidence)

- Audit §2.5 and U9; ledger A20.

## Read first

- `network/components/RouteManager.tsx` (~L1800–1960 fare editor; opportunities list)

## In scope

- Extract `FareEditor.tsx` and `OpportunitiesList.tsx` from `RouteManager.tsx`
- Live projection via S23's `projectRouteEconomics`
- Presets: Suggested / Aggressive / Premium
- Opportunities: default sort by projected profit/day
- Precise sweep of hard-coded strings → i18n (en + es); add a lint rule (e.g. `i18next/no-literal-string` scoped to `features/**`)

## Out of scope

- Changes to fare validation (S10 owns caps).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S24.1** Extract `FareEditor.tsx` (no behavior change). _Done when:_ tests green.
- [x] **S24.2** Live projection + Suggested/Aggressive/Premium presets. _Done when:_ screenshots.
- [x] **S24.3** Extract `OpportunitiesList.tsx`; default sort by projected profit/day (still virtualized). _Done when:_ tests green.
- [x] **S24.4** i18n sweep (en + es) + literal-string lint rule for `features/network`. _Done when:_ lint green.

## Details & guidance

- Keep virtualization in the opportunities list (Rule 5).
- Show an "above market" warning band once S10/S11 make it matter.

## Acceptance criteria

- [x] No literal strings in `RouteManager.tsx` and its new children (lint).
- [x] Screenshots (fare editor and opportunities checked locally; CI `screenshots` artifact on #168).

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-05 · S24.1 · (this commit) · The fare modal is now `network/components/FareEditor.tsx`. It owns its inputs, error, saving state, elasticity and revenue-projection math, and the save call; it seeds its inputs from the route's current fares and takes `{ target, onClose }`. Tone, parse and elasticity helpers shared with the route list moved to `network/utils/fareTones.ts`. `RouteManager.tsx` dropped from 2,100 to 1,518 lines. Behaviour is unchanged (copy still hard-coded; S24.4 sweeps it). New `FareEditor.test.tsx` covers seeding, use-suggested, saving and the empty-input error.
2026-10-05 · S24.2 · (this commit) · The fare editor now forecasts with `projectRouteEconomics`, the same functions the engine runs at each landing, at the typed fares and at today's fares, re-projected once per game hour. It replaces the old hand-rolled per-flight revenue estimate, which used the pre-S14 `computeRouteFrequency`. The "If you charge these fares" card shows seats filled, profit per day and market share, each with its change against now. Market share keeps one decimal below 10%, because a new airline's share of an incumbent market is small. Presets are Aggressive 0.85×, Suggested 1× and Premium 1.25× of suggested, rounded and capped at the fare cap; `aria-pressed` marks the matching one. These replace "Use suggested fares". Helpers live in `utils/fareProjection.ts`. New strings are i18n'd (en + es). Tests: helper unit tests, FareEditor (presets, live outcome, engine inputs) and `e2e/fare-editor.spec.ts`, which checks that Premium raises profit/day and that a $400 economy fare drops seats filled. Observed on MAD-BCN: seats stay at the 88% ceiling up to the Premium fares, so Premium earns more ($5,976 vs $3,372/day). This matches the known demand-scale follow-up.
2026-10-05 · S24.3 · (this commit) · Extracted `network/components/OpportunitiesList.tsx`. It owns its virtualizer (still `@tanstack/react-virtual`, Rule 5), its scroll-margin measurement, the open-route confirm flow and its own `openingRouteIata` state. `ProspectMarket` is exported from it. `RouteManager.tsx` is now 1,246 lines (2,100 at the start of S24). Each market is projected with S23's `recommendAircraftForRoute`, the same aircraft and figure the airport panel promises, as a new 7×/week route added to the network. The list is sorted by projected profit/day after lease, best first; markets no unlocked aircraft can reach go last and show "Out of range". The headline figure is now "Profit / day, with an <model>, after lease" instead of the old ATR-only per-flight estimate. The ranking lives in `utils/opportunityRanking.ts` (pure, stable on ties). Tests: ranking unit tests, plus OpportunitiesList order, out-of-range and projection inputs. One more `react-hooks/incompatible-library` lint warning is expected: the virtualizer now sits in its own component.
2026-10-05 · S24.4 · (this commit) · ESLint `no-restricted-syntax` now bans visible literals in `features/network/components/**/*.tsx` (tests exempt): JSX text with a word of 2+ letters, and literal `aria-label`/`title`/`placeholder`/`alt`. Unit symbols (km, kg, ft, UTC) and one-letter codes (Y/J/F, x, m, h) are allowed. It uses a built-in rule instead of `eslint-plugin-i18next`, so no new dependency, and it was checked to fire on an injected literal. Sweep: all 79 hits fixed across RouteManager, FareEditor, OpportunitiesList, HubPicker, FlightBoard and AircraftInfoPanel, plus literals in JS expressions the rule can't see (supply label, Oversupply/Coverage, Remove/Add/Hold fleet, Unknown airline). Copy was rewritten in player language as it moved (e.g. "LF" became "seats filled", "Monopoly Market" became "No rival airlines fly this route yet"). New shared `common.units.*` (hours, perWeek, perHour, timesPerWeek). New `src/i18n/parity.test.ts` fails if en and es differ in namespaces or keys; plural suffixes are compared by base key.

## Follow-ups

- **Default opportunity candidates are poor.** `buildProspects` picks the 2 nearest, 2 middle and 2 farthest airports from the origin. From MAD that gives Madrid's own airfields (ECV, TOJ, 22 km, losing money) plus four out-of-range destinations, so ranking has little to work with. Better: candidates within the tier's range, excluding same-city airfields (as `suggestStarterHubs` does), top N by gravity demand, then ranked by projected profit/day. Worth a step of its own (S24.5 or a later session).
- Premium beats Suggested on a full route because demand saturates seats (88% ceiling) far above the suggested fare. Once demand scale is fixed (balance follow-up), "Suggested" should be near the profit peak; re-check presets then.
- Above-market warning band: needs the incumbent's fare in `RouteProjection.incumbent` (today it carries frequency, seats and share only).

## Handoff notes

- **Shipped:**
  - `FareEditor.tsx` and `OpportunitiesList.tsx` extracted; `RouteManager.tsx` went from 2,100 to about 1,250 lines.
  - Outcome-first pricing: an engine-consistent forecast of seats filled, profit per day and market share as you type, plus Aggressive, Suggested and Premium presets.
  - Opportunities ranked by projected profit per day, using the aircraft the airport panel recommends.
  - Network screens fully i18n'd, with a lint guard and an en/es parity test.
- **Gotchas:**
  - Forecasts re-project once per game hour (`hourTick`), like the decision card.
  - `fareProjectionBase` returns null when nothing flies the route; the editor then asks for an aircraft.
  - The literal-string rule is scoped to `features/network/components`; widen the `files` glob to bring other features under it.
  - A `biome format` over a whole directory also reformats untouched legacy files (`flightNumber.ts` was swept in S24.2, format only).
- **Not done (see Follow-ups):**
  - Better default opportunity candidates.
  - An above-market warning, which needs the incumbent's fare in the projection.
  - Re-checking the presets once demand scale is fixed.
