# Globe-first 3D prototype: report for decision D4

> **Session:** [S45](sessions/S45-globe-first-prototype.md) · **Date:** 2026-10-07 · **Decision:** D4 (go/no-go on a globe-first 3D shell). The owner decides.

## TL;DR

- **The interaction model works.** The world fills the screen. A **briefing drawer** gathers "what matters now", and **contextual cards** answer "what is this?" with a door into the details. It reuses the cockpit's own cards, so it isn't a mock-up.
- **deck.gl is the weak part.** deck.gl 9.4 doesn't support MapLibre v6 yet:
  - It needed a shim to run at all.
  - Its arc and icon layers drew nothing on the v6 globe, so the prototype builds 3D arcs itself and draws planes as dots.
  - It adds **223 kB gzipped** on top of MapLibre.
- **Scale is fine on the CPU side.** Moving 50,000 aircraft takes 18 ms per update in JavaScript, inside the 200 ms map clock. Frame rate is bound by pixels. Without a GPU, the globe alone tops out at 8.5 fps in headless Chromium; GPU desktop and mid-range Android numbers still need measuring (see "Measure on your devices").
- **Recommendation: go on the globe-first shell, no-go on deck.gl for now.** Build the drawer and card model on the existing MapLibre globe (`@acars/map`), which already draws arcs and aircraft icons and has the S54 low-power mode. Revisit deck.gl when it supports MapLibre v6, or if real-device numbers show MapLibre alone can't carry the aircraft counts we need.

## What was built

All of it is behind a flag at `/play` (`?prototype=on` turns it on for a browser; `?prototype=off` turns it off).

| Piece            | What it does                                                                                                                       | Step  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Globe            | MapLibre globe with deck.gl interleaved in the same WebGL context; opens tilted on the player's network.                           | S45.1 |
| Route arcs       | Every airline's active routes as 3D great-circle arcs: livery colours (lifted when too dark), width by frequency, rivals dimmer.   | S45.1 |
| Aircraft         | Every flight in the air rides its route's arc; positions come from typed arrays (binary attributes), updated 5×/s.                 | S45.2 |
| Load generator   | `?load=1000\|10000\|50000` adds seeded synthetic flights between the busiest airports; `?orbit=1` spins the camera for benchmarks. | S45.2 |
| Contextual cards | Click a route, airport or plane. The most specific thing wins (airport, then plane, then route). Links into the classic view.      | S45.3 |
| Briefing drawer  | Cash, routes and planes in the air, plus the cockpit's World events and Daily objectives cards.                                    | S45.3 |
| fps readout      | On screen whenever a load or orbit is on, for measuring real devices.                                                              | S45.4 |

## Recording and screenshots

- [`media/s45/play-walkthrough.webm`](media/s45/play-walkthrough.webm), 30 s. A guest signs up, launches Madrid → Barcelona, opens `/play`, clicks the airport and the route, then opens the briefing. This is the e2e run recorded (`S45_VIDEO=1`), so it is reproducible.
- Screenshots: [route card](media/s45/play-card-route.png) · [airport card](media/s45/play-card-airport.png) · [briefing](media/s45/play-briefing.png) · [10k aircraft](media/s45/play-10k-aircraft.png).

## Performance

### Measured: headless Chromium, software WebGL (worst case)

From `e2e/play-perf.spec.ts`: the camera orbits, forcing a full redraw every frame, with a 10 s sample after a 3 s warm-up. The machine is a CI-class container with no GPU, like players without hardware acceleration (S54).

|       Aircraft | fps | Position update (JS) | JS heap |
| -------------: | --: | -------------------: | ------: |
| 0 (globe only) | 8.5 |               0.3 ms |   37 MB |
|          1,000 | 7.2 |               0.7 ms |   37 MB |
|         10,000 | 3.5 |                 4 ms |   35 MB |
|         50,000 | 1.4 |                18 ms |   42 MB |

Reading it:

- **The globe itself is the ceiling** without a GPU: 8.5 fps before a single plane. The classic shell runs the same MapLibre globe, so this ceiling is not deck.gl's doing. It is why S54 added low-power mode.
- **Planes cost little up to about 1k**, then pixel work dominates: every dot is drawn every frame.
- **The CPU side scales.** 50k positions take 18 ms, about 9% of a 200 ms clock tick, with no per-plane objects. That design (schedules in, typed arrays out) is worth keeping whatever renders it.
- **Memory is flat** (35–42 MB JS heap): the buffers are small.
- deck.gl reports two frames per browser frame: one per interleaved layer group.

### Bundle

| Chunk                                        |    Gzipped | Loaded by                    |
| -------------------------------------------- | ---------: | ---------------------------- |
| MapLibre and `@acars/map` (`Globe-*.js`)     |     299 kB | both shells                  |
| deck.gl and the prototype (`PlayGlobe-*.js`) | **223 kB** | `/play` only (lazy, flag on) |

### Measure on your devices (needed for D4)

On a **GPU desktop** and a **mid-range Android** (Chrome):

1. Open `https://<site>/play?prototype=on&load=10000&orbit=1`. The globe spins and the fps shows under the aircraft count.
2. Let it run for 10 s and note the fps. Repeat with `load=1000` and `load=50000`, and with `load=0` for the baseline.
3. On Android, also note whether the phone warms up after a minute (battery).

Rough bar: **30 fps or more at 10k on the Android** means a 3D shell is viable on phones. Below 15 fps it is not, whatever renders it.

## Findings: deck.gl 9.4 on MapLibre v6

1. **Crash on every frame.** deck.gl reads `map.transform`, which MapLibre v6 moved to `map._camera.transform`. The fix is a shim (`features/play/mapCompat.ts`) that leans on MapLibre internals.
2. **`ArcLayer` doesn't render usefully on the v6 globe**, interleaved or overlaid: tall arcs were clipped to stubs, and flat great-circle arcs didn't show at all. The workaround is `arcPath`, which builds the great circle with a sine altitude profile, drawn by a `PathLayer`.
3. **`IconLayer` draws nothing on the v6 globe**: not with binary or plain data, and not with an SVG or a PNG atlas. Planes are drawn as dots (`ScatterplotLayer`), so there is no plane silhouette or heading.
4. **The CSP blocks deck.gl's atlas fetch.** deck.gl `fetch`es icon atlases, and the app's `connect-src` blocks `data:` URLs, so atlases must be same-origin files.
5. **Picking works well.** `pickMultipleObjects` plus a priority rule makes clicks on dense hubs predictable.

Two things worked with no friction: `PathLayer`, `ScatterplotLayer` (including binary attributes) and picking.

## Parity checklist (prototype vs the classic shell)

| Area                                   | Classic | `/play`                                   |
| -------------------------------------- | :-----: | ----------------------------------------- |
| World map with your routes             |   ✅    | ✅ 3D arcs                                |
| Rival routes on the map                |   ✅    | ✅ dimmed                                 |
| Aircraft in flight                     |   ✅    | ⚠️ dots, no icon or heading (finding 3)   |
| Airport details                        |   ✅    | ⚠️ card with link to classic panel        |
| Route details and economics            |   ✅    | ⚠️ card (owner, frequency, distance) only |
| Aircraft details                       |   ✅    | ⚠️ progress and ETA only                  |
| Launch a route                         |   ✅    | ❌ (via the classic view)                 |
| Fleet: buy, lease, assign, maintenance |   ✅    | ❌                                        |
| Fares, frequency, policies             |   ✅    | ❌                                        |
| Finance and corporate                  |   ✅    | ⚠️ cash only (briefing)                   |
| Leaderboard and rivals                 |   ✅    | ❌                                        |
| World events                           |   ✅    | ✅ briefing                               |
| Daily objectives                       |   ✅    | ✅ briefing (claimable)                   |
| Ticker, notifications, away report     |   ✅    | ❌ (away report and toasts still global)  |
| Share, milestone posts                 |   ✅    | ❌                                        |
| Mobile layout                          |   ✅    | ⚠️ works, not designed for small screens  |
| Low-power mode (S54)                   |   ✅    | ❌                                        |
| Light map theme                        |   ✅    | ❌ dark only                              |
| Spanish                                |   ✅    | ✅                                        |

The gaps are expected for a prototype: none of them is blocked by the globe-first model. Every row can be a card or a drawer section.

## Options for D4

| Option                                       | Cost                                                                       | Risk                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **A. Globe-first on MapLibre (recommended)** | Port the drawer and cards into the main shell; no new rendering dependency | Low: MapLibre already draws arcs and aircraft icons in production |
| B. Globe-first on deck.gl                    | As A, plus deck.gl (223 kB) and shims                                      | High until deck.gl supports MapLibre v6; icons missing            |
| C. No-go                                     | None                                                                       | Keeps the panel-heavy shell the overhaul set out to rethink       |

## Reproduce

- `pnpm --filter @acars/web exec playwright test e2e/play-prototype.spec.ts e2e/play-perf.spec.ts --project=desktop`
- Add `S45_PERF_OUT=<dir>` for JSON results, `S45_SCREENSHOT=<dir>` for screenshots and `S45_VIDEO=1` for the recording.
