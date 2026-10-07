# S45 — Globe-first 3D shell prototype (deck.gl)

> **Status:** ☑ merged
> **Next step:** —
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** — (merged in #187)
>
> **Track:** Graphics · **Size:** L (4 steps) · **Depends on:** S01 · **Unblocks:** Decision D4
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Prove or disprove the globe-first 3D interface: the world is the whole UI, with a briefing drawer and contextual cards.

## Why (evidence)

- Owner's request to rethink the UI from first principles; audit discussion of 3D options.

## Read first

- `docs/DESIGN_PRINCIPLES.md` (Mini Metro / Factorio targets)
- `packages/store` public hooks
- deck.gl + MapLibre globe interleaving docs

## In scope

- A new route `/play` behind a feature flag, built from **new files only**: deck.gl `ArcLayer` (3D great-circle arcs), `ScenegraphLayer` or `IconLayer` for aircraft, briefing drawer, contextual card on click
- Reuse store hooks and S23's projection if merged

## Out of scope

- Replacing the existing shell. This is a prototype.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S45.1** Flagged `/play` route: deck.gl on globe with 3D arcs. _Done when:_ renders with real routes.
- [x] **S45.2** Aircraft layer + synthetic load generator (1k/10k/50k). _Done when:_ fps recorded.
- [x] **S45.3** Briefing drawer + contextual airport/route/plane cards. _Done when:_ screen recording.
- [x] **S45.4** `docs/overhaul/prototype-report.md` with perf + parity checklist. _Done when:_ owner can decide D4.

## Details & guidance

- Perf report: 1k / 10k / 50k simulated aircraft on desktop and a mid-range Android (fps, memory, battery note).
- Interaction parity checklist vs the current shell (what's missing).
- A 60-second screen recording for the owner.

## Acceptance criteria

- [x] The report and recording are in `docs/overhaul/prototype-report.md`; the owner records decision D4 (open: needs the owner's real-device fps, see the report).

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-07 · S45.1 · (this commit) · **Flagged `/play`: deck.gl on the MapLibre globe, with 3D arcs from real routes.**

- **Flag.** `features/play/playFlag.ts`: off by default. It turns on for a build with `VITE_PLAY_PROTOTYPE=1`, or for one browser by opening `/play?prototype=on` (`?prototype=off` turns it off again). With the flag off, `/play` shows a short explainer with a button to turn it on.
- **Shell.** `/play` is a standalone route: no HUD, and no background globe, so two WebGL maps never compete. `__root.tsx` is the only existing file touched (`OWN_WORLD_ROUTES`). deck.gl and its MapLibre map load in a lazy chunk (`PlayGlobe`, about 214 kB gzipped) only when the flag is on.
- **World.** `PlayGlobe` creates its own MapLibre globe, with deck.gl **interleaved** in the same WebGL context through `MapboxOverlay`. It opens on the player's own network, tilted 40°. `usePlayArcs` builds arcs from the store: rival routes from world sync (dimmer and thinner) and the player's routes on top, in livery colours, with width by weekly frequency.
- **Findings for D4 (deck.gl on MapLibre v6):**
  1. deck.gl 9.4 reads `map.transform`. MapLibre v6 moved it to `map._camera.transform`, which crashed every frame. `mapCompat.ts` shims it back; deck.gl relies on MapLibre internals.
  2. deck.gl's `ArcLayer` drew nothing useful on the v6 globe in either interleaved or overlaid mode: tall arcs were clipped to stubs, and flat great-circle arcs didn't show at all. A `ScatterplotLayer` rendered fine. The prototype builds the 3D arc itself (`arcPath`: points along the great circle raised on a sine curve, peak 8% of the length) and draws it with a `PathLayer`.
  3. MapLibre makes its container `position: relative`, so the map needs a positioned wrapper.
  4. Many liveries are dark navy and vanish on the night globe, so `readableOnDark` lifts colours below 0.18 luminance toward white, keeping the hue.
- **Dependencies:** `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox` 9.4 in `apps/web`. deck.gl pulls in `apache-arrow`, which depends on `@types/node` 25 and dragged the root test tooling's types along with it. A `pnpm` override (`apache-arrow>@types/node`) keeps the lockfile change to the new packages.
- **Tests:**
  - Unit tests for the flag, arcs, colours, camera focus, `arcPath` and the shim.
  - e2e `play-prototype.spec.ts`: `/play` is off by default. Turned on, it draws the player's launched MAD → BCN as one arc (`data-arc-count`), deck.gl reports frames (`window.__acarsPlayStats`), and "Classic view" goes back.

2026-10-07 · S45.2 · (this commit) · **Aircraft layer and load generator; fps recorded.**

- **Aircraft.** `features/play/aircraft.ts`: every in-flight aircraft (player and rivals) plus `?load=1000|10000|50000` synthetic ones.
  - Synthetic flights are seeded and drawn between the 2,000 most-populated airports, 300–9,000 km apart. Each loops its leg, so the load stays constant.
  - Planes ride their route's arc: position along the great circle, altitude from the same curve as the arcs.
  - Every 200 ms (the S54 map-clock rate), positions are written into typed arrays that deck.gl reads as binary attributes. That is O(N), with no per-plane objects.
- **Drawn as dots, not icons.** deck.gl 9.4's `IconLayer` drew nothing on the MapLibre v6 globe: not with binary or plain data, and not with an SVG or a PNG atlas. A `ScatterplotLayer` works, and is what the numbers below measure. A further gotcha: deck.gl fetches icon atlases, and the app's CSP blocks `data:` fetches (`connect-src`), so a same-origin file is needed.
- **Benchmark.** `e2e/play-perf.spec.ts`, serial: `/play?load=N&orbit=1` turns the camera every frame, forcing a full redraw, and samples 10 s after a 3 s warm-up. `S45_PERF_OUT` writes JSON.
- **Numbers.** CI-class machine, headless Chromium, **software WebGL** (the worst case, as in S54). A GPU desktop and a mid-range Android still need measuring for the report (S45.4).

  |           Load | fps | Position update (JS) | JS heap |
  | -------------: | --: | -------------------: | ------: |
  | 0 (globe only) | 8.5 |               0.3 ms |   37 MB |
  |             1k | 7.2 |               0.7 ms |   37 MB |
  |            10k | 3.5 |                 4 ms |   35 MB |
  |            50k | 1.4 |                18 ms |   42 MB |
  - Under software rendering the globe alone sets the ceiling (8.5 fps). Planes cost little at 1k, then pixels dominate.
  - The JS update stays well inside the 200 ms clock even at 50k (18 ms, about 9% of a tick), so CPU-side position math scales.
  - deck.gl counts two frames per browser frame: one per interleaved layer group (arcs, planes).

- **Seen in the screenshots.** Long-haul planes fly visibly high (the 8% peak means about 700 km on a 9,000 km leg) and show past the globe's edge. Cap the altitude if this goes further.

2026-10-07 · S45.3 · (this commit) · **Briefing drawer and contextual cards, with a screen recording.**

- **Cards.** Routes (arcs), airports (a new clickable layer of every network endpoint) and planes are pickable, and a click opens a card at the bottom of the screen:
  - **Route:** whose it is, flights a week and distance.
  - **Airport:** city and name, plus your routes and the world's routes through it.
  - **Plane:** a real flight's progress bar and minutes to landing, or "synthetic traffic" for the load generator.
  - Route and airport cards link into the classic view (`/airport/$iata`). An empty click closes the card.
- **Picking rule.** deck.gl returns every object within 6 px, and the most specific wins (airport, then plane, then route), so a click on a hub opens the airport, not one of the arcs ending on it.
- **Briefing drawer.** A side panel with cash, routes and planes in the air, then the cockpit's own World events and Daily objectives cards (real content, no mock-ups).
- **Logic in pure modules:** `cardModels.ts` and `selection.ts`, with unit tests.
- **e2e** (`play-prototype.spec.ts`) clicks Barcelona (airport card), the MAD → BCN arc (route card), closes it, and opens and closes the briefing.
- **Media** (`docs/overhaul/media/s45/`): `play-walkthrough.webm`, a 30 s recording of the e2e run (`S45_VIDEO=1`), plus screenshots of the route card, airport card, briefing and 10k aircraft.
- **Gotcha:** a test that clicks an arc must account for its altitude. The projection hook (`window.__acarsPlayProject`) maps surface points, so the click goes near a route's end, where the arc is still low.

2026-10-07 · S45.4 · (this commit) · **Report for D4: `docs/overhaul/prototype-report.md`.**

- **Contents:** what was built, the recording and screenshots, the measured numbers (software WebGL, worst case), bundle cost, the deck.gl / MapLibre v6 findings, the parity checklist against the classic shell, and options A/B/C with a recommendation.
- **Recommendation:** A, a globe-first shell on the existing MapLibre globe, with no deck.gl for now.
- **Real devices.** GPU desktop and mid-range Android numbers can't be taken from CI. `/play` now shows an **fps readout** whenever a load or orbit is on (`/play?prototype=on&load=10000&orbit=1`), and the report gives the owner a 2-minute recipe with a bar (≥ 30 fps at 10k on Android means viable). The perf probe checks the readout.

## Follow-ups

- **Owner:** measure `/play` on a GPU desktop and a mid-range Android (recipe in the report), then record D4.
- **If D4 = A (MapLibre):** port the briefing drawer and contextual cards into the main shell (a new session); reuse `cardModels.ts`, `selection.ts`, and the schedule → typed-array plane pipeline from `aircraft.ts`.
- **If D4 = B (deck.gl):** wait for deck.gl's MapLibre v6 support, then drop `mapCompat.ts`, retry `ArcLayer`/`IconLayer`, and cap arc altitude for long-haul (about 700 km peaks look odd).
- **Either way:** remove `/play` and the deck.gl dependency once D4 is recorded and its outcome is built.

## Handoff notes

- **Shipped:** a flagged `/play` prototype with a globe, 3D route arcs, aircraft with a 1k/10k/50k load generator, clickable cards, a briefing drawer and an fps readout. Also the report, recording and screenshots, and two e2e specs (behaviour and perf).
- **Didn't ship:**
  - Real-device numbers: CI has no GPU or phone, so they are the owner's to take.
  - Plane icons and headings: deck.gl's `IconLayer` didn't render on MapLibre v6.
  - deck.gl's own `ArcLayer`: replaced with `PathLayer` arcs.
- **Gotchas:**
  - deck.gl 9.4 needs `shimMapTransform` on MapLibre v6.
  - The CSP blocks `data:` fetches, so atlases must be same-origin files.
  - MapLibre's container class overrides `absolute`, so the map needs a wrapper.
  - Dark liveries vanish on the night globe (`readableOnDark`).
  - Clicking arcs in e2e must account for altitude.
  - Installing deck.gl re-resolved `@types/node` for the root tooling, so a targeted `pnpm` override keeps the lockfile clean.
- **Footprint:** new files under `features/play/`, `routes/play.tsx` and `-play.lazy.tsx`. The only existing file touched is `__root.tsx` (`/play` is standalone and skips the background globe), plus en/es strings, the deps and the override.
