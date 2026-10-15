# S82 — The away replay flies its planes

> **Status:** ◑ in review
> **Next step:** — (merge)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** (opening)
>
> **Track:** Fix · **Size:** S (1 step) · **From:** owner, 2026-10-15: "los aviones no vuelan correctamente durante ese replay, sino que saltan de un aeropuerto al destino, al origen, al destino, sin los pasos intermedios"

## What was wrong

- The globe's animation loop (`packages/map/src/Globe.tsx`) is set up once (deps: map loaded, airports, palette) and read the `engineClock` prop from that first closure. The away replay (S55.3) swaps in its own clock (`useTimeLapsePlayback`), but the loop kept the live engine clock. Every replayed leg is in the past by the live clock, so each plane was drawn at progress 1, its leg's destination: as legs came and went, planes hopped destination → origin → destination with nothing in between.
- The S55.3 e2e only checked the replay bar, never where the planes were.
- "Watch what happened" started the replay over whatever screen was open: on a phone the cockpit or a panel covers the map, so the replay played out of sight.

## Fix

- `Globe.tsx`: the clock goes through a `latestEngineClock` ref like the loop's other inputs, so a swapped clock takes effect on the next map tick.
- `renderStats.ts`: `__acarsMapStats.flightProgress` holds how far along its leg each of the player's drawn flights was at the last upload (only on upload; e2e only reads it).
- `AwayReport.tsx`: "Watch what happened" is a link to `/?panel=map`, the bare map, then starts the replay.

## Progress log

- 2026-10-15 · S82.1 · fix + e2e: `away-report.spec.ts` now requires a replayed plane mid-leg (progress strictly between 0.02 and 0.98) and the `/?panel=map` URL. **Proof:** with the loop reading the stale prop, the spec fails (no plane ever mid-flight); with the fix it passes. Unit tests (map 133, airline 76), typecheck, lint; e2e away report, map and perf probe on desktop and mobile pass. Screenshots: `media/s82/replay-mid-flight-{1440,390}.png` (the 390 one from a temporary mobile copy of the spec).
